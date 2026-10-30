// Local development only:  npm run dev:server
require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`));
