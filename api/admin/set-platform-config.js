const admin = require('firebase-admin');

// Initialize Firebase from Base64 env or direct JSON env
let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  try {
    serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  } catch(e) { /* ignore and fallback */ }
}
if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch(e) { /* ignore */ }
}
if (serviceAccount && (!admin.apps || admin.apps.length === 0)) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = (admin.apps && admin.apps.length) ? admin.firestore() : null;

module.exports = async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const headerSecret = (req.headers['x-admin-secret'] || '').toString();
  const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
  if (!envSecret) {
    return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
  }
  if (!headerSecret || headerSecret !== envSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // parse body
  let body = req.body;
  if (!body || Object.keys(body).length === 0) {
    // Vercel / some setups may not parse JSON automatically; try raw
    try { body = JSON.parse(req.rawBody || '{}'); } catch (e) { body = {} }
  }

  const { displayRates, platformDeposit } = body || {};
  if (!displayRates && !platformDeposit) {
    return res.status(400).json({ ok: false, error: 'Nothing to update (expect displayRates or platformDeposit)' });
  }

  // Ensure Firebase was initialized at module load time
  try {
    if (!db) return res.status(500).json({ ok: false, error: 'FIREBASE_SERVICE_ACCOUNT env missing or invalid' });
    const docRef = db.doc('platform/platform');
    const now = new Date().toISOString();
    const payload = { updatedAt: now };
    if (displayRates) payload.displayRates = displayRates;
    if (platformDeposit) payload.platformDeposit = platformDeposit;

    await docRef.set(payload, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('set-platform-config error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};