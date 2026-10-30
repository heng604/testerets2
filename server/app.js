// Express app (no listen() here, so Vercel can use it as a serverless function).
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const product = require('./controllers/productController');
const deposit = require('./controllers/depositController');
const user = require('./controllers/userController');
const payway = require('./controllers/paywayController');
const bakong = require('./controllers/bakongController');
const bakongTest = require('./controllers/bakongTestController');
const report = require('./controllers/reportController');
const settings = require('./controllers/settingsController');
const stats = require('./controllers/statsController');
const authCtl = require('./controllers/authController');
const { requireAdmin } = require('./lib/auth');

const app = express();
app.set('trust proxy', 1); // required behind Vercel's proxy, or express-rate-limit throws

const limiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: message } });
const generalLimiter = limiter(15 * 60 * 1000, 600, 'Too many requests — please wait a few minutes and try again.');
const authLimiter = limiter(60 * 1000, 20, 'Too many login attempts — please wait a moment before trying again.');
const purchaseLimiter = limiter(15 * 60 * 1000, 10, 'Too many purchase requests — please slow down.');
const bakongPollLimiter = limiter(60 * 1000, 60, 'Too many status checks — please wait a moment.');

// Vercel rejects request bodies > 4.5 MB, so keep our own limit just under it.
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(cors({
  origin: [
    'http://localhost:5173', 'http://localhost:5174',
    process.env.FRONTEND_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ].filter(Boolean),
  credentials: true,
}));
app.use(generalLimiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed'))),
});
const handleUpload = (req, res, next) =>
  upload.single('image')(req, res, (err) => (err ? res.status(400).json({ error: err.message }) : next()));

const A = requireAdmin;

app.get('/api', (req, res) => res.json({ status: 'ok', message: 'Masatoshi API running (Supabase)' }));
app.get('/api/health', (req, res) => res.json({
  status: 'ok', supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  jwtConfigured: !!process.env.JWT_SECRET, region: process.env.VERCEL_REGION || 'local',
}));

// Auth
app.post('/api/auth/google', authLimiter, authCtl.google);

// Products
app.get('/api/products', product.getAllProducts);
app.get('/api/products/:id', product.getProductById);
app.post('/api/log-upload', A, product.createProduct);
app.patch('/api/products/:id', A, product.updateProduct);
app.patch('/api/products/:id/label', A, product.setLabel);
app.delete('/api/products/:id', A, product.deleteProduct);
app.post('/api/products/:id/clear-update', A, product.clearProductUpdate);
app.post('/api/products/:id/purchase-by-email', purchaseLimiter, product.purchaseProductByEmail);

// Purchases / orders
app.get('/api/purchases/by-email/:email', product.getPurchasesByEmail);
app.post('/api/purchases/:purchaseId/acknowledge-update', product.acknowledgeUpdate);
app.post('/api/purchases/:purchaseId/mark-downloaded', product.markDownloaded);
app.get('/api/orders', A, product.getAllOrders);
app.patch('/api/orders/:id', A, product.updateOrder);
app.delete('/api/orders/:id', A, product.deleteOrder);

// Deposits
app.post('/api/deposits', deposit.createDepositRequest);
app.get('/api/deposits/pending', A, deposit.getPendingDeposits);
app.get('/api/deposits/bakong', A, deposit.getBakongDeposits);
app.patch('/api/deposits/:depositId/verify', A, deposit.verifyDeposit);

// Users (static paths before :email)
app.get('/api/users', A, user.getAllUsers);
app.get('/api/users/banned', A, user.getBannedUsers);
app.delete('/api/users/banned/:email', A, user.unbanUser);
app.patch('/api/users/:email', A, user.updateUser);
app.delete('/api/users/:email', A, user.deleteUser);
app.get('/api/users/points/:email', authLimiter, user.getPointsByEmail);
app.get('/api/users/avatar/:email', authLimiter, user.getAvatar);
app.patch('/api/users/avatar/:email', user.updateAvatar);
app.post('/api/users/deduct/:email', A, user.deductPointsByEmail);

// ABA
app.post('/api/payway/checkout', payway.createCheckoutLink);

// Bakong (customer)
app.post('/api/bakong/generate', bakong.generateQR);
app.get('/api/bakong/status/:depositId', bakongPollLimiter, bakong.checkStatus);
// Bakong tester (admin)
app.post('/api/admin/bakong/diagnose', A, bakongTest.diagnose);
app.post('/api/admin/bakong/test-qr', A, bakongTest.createTestQR);
app.get('/api/admin/bakong/test-qr/:id/check', A, bakongTest.checkTestQR);
app.get('/api/admin/bakong/history', A, bakongTest.history);
// Optional cron (needs CRON_SECRET)
app.get('/api/cron/bakong-poll', bakong.cronPoll);

// Reports
app.post('/api/reports', report.createReport);
app.get('/api/reports', A, report.getAllReports);
app.get('/api/reports/by-email/:email', report.getReportsByEmail);
app.patch('/api/reports/:reportId', A, report.updateReport);
app.get('/api/export/:type', A, report.exportData);

// Settings
app.get('/api/settings', settings.getSettings);
app.get('/api/settings/admin', A, settings.getAdminSettings);
app.patch('/api/settings', A, settings.updateSettings);
app.get('/api/settings/banners', settings.getBanners);
app.put('/api/settings/banners', A, settings.replaceBanners);
app.post('/api/settings/banners/upload', A, handleUpload, settings.uploadBanner);
app.delete('/api/settings/banners/:index', A, settings.deleteBanner);

app.get('/api/stats/dashboard', A, stats.getDashboardStats);

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
