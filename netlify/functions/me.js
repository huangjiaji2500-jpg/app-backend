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

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'method_not_allowed' });

  try { initFirebase(); } catch (e) { console.error('[ME] firebase init error', e && e.message); return jsonResponse(500, { error: 'firebase_not_configured' }); }
  const db = adminLib.firestore();

  const auth = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) return jsonResponse(401, { error: 'missing_authorization' });
  const token = auth.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || '';
  if (!JWT_SECRET) return jsonResponse(500, { error: 'jwt_not_configured' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded && decoded.id;
    if (!userId) return jsonResponse(401, { error: 'invalid_token' });
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return jsonResponse(404, { error: 'user_not_found' });
    const data = doc.data();
    const userPublic = { id: doc.id, username: data.username, createdAt: data.createdAt };
    return jsonResponse(200, { success: true, user: userPublic });
  } catch (e) {
    console.error('[ME] error', e && (e.stack || e.message));
    return jsonResponse(401, { error: 'invalid_token_or_expired' });
  }
};
