const adminLib = require('firebase-admin');
const jwt = require('jsonwebtoken');

function initFirebase() {
  if (adminLib.apps && adminLib.apps.length) return adminLib.app();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  const json = Buffer.from(b64, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(json);
  return adminLib.initializeApp({ credential: adminLib.credential.cert(serviceAccount) });
}

function jsonResponse(res, statusCode, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.statusCode = statusCode;
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, { ok: true });
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method_not_allowed' });

  try { initFirebase(); } catch (e) { console.error('[me] firebase init error', e && e.message); return jsonResponse(res, 500, { error: 'firebase_not_configured' }); }
  const db = adminLib.firestore();

  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) return jsonResponse(res, 401, { error: 'missing_authorization' });
  const token = auth.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || '';
  if (!JWT_SECRET) return jsonResponse(res, 500, { error: 'jwt_not_configured' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded && decoded.id;
    if (!userId) return jsonResponse(res, 401, { error: 'invalid_token' });
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return jsonResponse(res, 404, { error: 'user_not_found' });
    const data = doc.data();
    // Prefer explicit topupBalance on user doc; if not present, try user_balances collection lookup
    let topup = 0;
    try {
      if (typeof data.topupBalance !== 'undefined') topup = Number(data.topupBalance) || 0;
      else {
        const ub = await db.collection('user_balances').doc(data.username || doc.id).get();
        if (ub.exists) topup = Number(ub.data().topupBalance) || 0;
      }
    } catch (e) { topup = 0; }
    const userPublic = { id: doc.id, username: data.username, createdAt: data.createdAt, topupBalance: topup };
    return jsonResponse(res, 200, { success: true, user: userPublic });
  } catch (e) {
    console.error('[me] error', e && (e.stack || e.message));
    return jsonResponse(res, 401, { error: 'invalid_token_or_expired' });
  }
};
