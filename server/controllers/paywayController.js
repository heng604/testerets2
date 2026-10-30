const crypto = require('crypto');
module.exports = {
  createCheckoutLink: async (req, res) => {
    try {
      const { amountUsd } = req.body || {};
      const merchantId = process.env.ABA_MERCHANT_ID;
      const apiKey = process.env.ABA_API_KEY;
      if (!merchantId || !apiKey) return res.status(503).json({ error: 'ABA PayWay is not configured.' });
      const base = process.env.FRONTEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
      const merchantTxnId = `ABA-${Date.now()}`;
      res.json({
        action: process.env.ABA_GATEWAY_URL || 'https://checkout.payway.com.kh/api/payment-gateway',
        formData: {
          merchant_id: merchantId, merchant_txn_id: merchantTxnId, amount: amountUsd, currency: 'USD',
          return_url: `${base}/topup`,
          signature: crypto.createHmac('sha256', apiKey).update(`${merchantId}${merchantTxnId}${amountUsd}`).digest('hex'),
        },
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },
};
