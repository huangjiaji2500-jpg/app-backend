const adminLib = require('firebase-admin');
const bcrypt = require('bcryptjs');
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  try { initFirebase(); } catch (e) { console.error('[LOGIN] firebase init error', e && e.message); return jsonResponse(500, { error: 'firebase_not_configured' }); }
  const db = adminLib.firestore();

  let payload = {};
  try { payload = event.body ? JSON.parse(event.body) : {}; } catch (e) { return jsonResponse(400, { error: 'invalid_json' }); }

  const username = payload.username && String(payload.username).trim();
  const password = payload.password && String(payload.password);

  if (!username || !password) return jsonResponse(400, { error: 'username_and_password_required' });

  const JWT_SECRET = process.env.JWT_SECRET || '';
  if (!JWT_SECRET) return jsonResponse(500, { error: 'jwt_not_configured' });

  try {
    const usersRef = db.collection('users');
    const q = await usersRef.where('username', '==', username).limit(1).get();
    if (q.empty) return jsonResponse(404, { error: 'user_not_found' });
    const doc = q.docs[0];
    const data = doc.data();
    const storedHash = data.passwordHash || '';
    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) return jsonResponse(401, { error: 'invalid_credentials' });
    const token = jwt.sign({ id: doc.id, username }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const userPublic = { id: doc.id, username: data.username, createdAt: data.createdAt };
    return jsonResponse(200, { success: true, token, user: userPublic });
  } catch (e) {
    console.error('[LOGIN] error', e && (e.stack || e.message));
    return jsonResponse(500, { error: 'internal_server_error' });
  }
};
