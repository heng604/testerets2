// Converts Postgres rows (snake_case) into the exact JSON shapes the React
// frontend already expects from the old Mongo API (camelCase + `_id`).
const num = (v, d = 0) => (v === null || v === undefined ? d : Number(v));

const toMod = (r, { withDownload = true } = {}) => r && ({
  _id: r.id,
  title: r.title,
  priceInPoints: num(r.price_in_points),
  discountCode: r.discount_code || '',
  discountPercent: num(r.discount_percent),
  ownerName: r.owner_name || 'Masatoshi',
  description: r.description,
  images: r.images || [],
  screenshots: r.screenshots || [],
  details: r.details || [],
  ...(withDownload ? { downloadUrl: r.download_url } : {}),
  version: r.version || '',
  label: r.label || 'none',
  uploadedAt: r.uploaded_at,
  lastUpdatedAt: r.last_updated_at,
});

const toUser = (r) => r && ({
  _id: r.id,
  googleId: r.google_id,
  username: r.username,
  avatar: r.avatar,
  email: r.email,
  points: num(r.points),
  role: r.role,
  loginCount: r.login_count || 0,
  lastLogin: r.last_login || null,
  createdAt: r.created_at,
});

const toPurchase = (r) => r && ({
  _id: r.id,
  userId: r.user_id,
  userEmail: r.user_email,
  modId: r.mod_id,
  pointsSpent: num(r.points_spent),
  purchasedAt: r.purchased_at,
  notifiedUpdateAt: r.notified_update_at,
  downloaded: !!r.downloaded,
});

const toDeposit = (r) => r && ({
  _id: r.id,
  depositId: r.deposit_id,
  userEmail: r.user_email,
  method: r.method,
  amount: num(r.amount),
  slipUrl: r.slip_url,
  status: r.status,
  timestamp: r.timestamp,
  source: r.source,
  currency: r.currency,
  points: r.points === null ? undefined : num(r.points),
  pointRateUsed: r.point_rate_used === null ? undefined : num(r.point_rate_used),
  khqrString: r.khqr_string,
  md5: r.md5,
  expiresAt: r.expires_at,
  checkErrorCount: r.check_error_count || 0,
});

const toReport = (r) => r && ({
  _id: r.id,
  reportId: r.report_id,
  userEmail: r.user_email,
  username: r.username,
  subject: r.subject,
  category: r.category,
  message: r.message,
  status: r.status,
  adminNote: r.admin_note,
  timestamp: r.timestamp,
  resolvedAt: r.resolved_at,
});

const toBanned = (r) => r && ({
  _id: r.id,
  email: r.email,
  reason: r.reason,
  bannedAt: r.banned_at,
  attemptCount: r.attempt_count,
  lastAttemptAt: r.last_attempt_at,
  lockedUntil: r.locked_until,
});

const toSettings = (r, { withToken = true } = {}) => r && ({
  _id: r.id,
  key: r.key,
  siteName: r.site_name,
  telegramUrl: r.telegram_url,
  discordUrl: r.discord_url,
  pointRate: num(r.point_rate, 100),
  bakongAccountId: r.bakong_account_id,
  ...(withToken ? { bakongToken: r.bakong_token } : { bakongTokenSet: !!r.bakong_token }),
  bakongBaseUrl: r.bakong_base_url,
  bakongMerchantName: r.bakong_merchant_name,
  bakongMerchantCity: r.bakong_merchant_city,
  usdExchangeRate: num(r.usd_exchange_rate, 4100),
  bannerImages: r.banner_images || [],
  updatedAt: r.updated_at,
});

module.exports = { toMod, toUser, toPurchase, toDeposit, toReport, toBanned, toSettings, num };
