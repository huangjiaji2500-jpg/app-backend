// Lightweight health endpoint to verify serverless functions are reachable
module.exports = (req, res) => {
  try {
    const now = new Date().toISOString();
    const hasFsBase64 = !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const hasFsJson = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    const hasMongo = !!process.env.MONGODB_URI;
    return res.status(200).json({ ok: true, now, env: { hasFsBase64, hasFsJson, hasMongo } });
  } catch (e) {
    console.error('health error', e && e.stack ? e.stack : e);
    return res.status(500).json({ ok: false, error: 'health check failed' });
  }
};
