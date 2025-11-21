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

function jsonResponse(res, statusCode, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.statusCode = statusCode;
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, { ok: true });
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method_not_allowed' });

  try { initFirebase(); } catch (e) { console.error('[login] firebase init error', e && e.message); return jsonResponse(res, 500, { error: 'firebase_not_configured' }); }
  const db = adminLib.firestore();

  let payload = {};
  try { payload = req.body ? (typeof req.body === 'object' ? req.body : JSON.parse(req.body)) : {}; } catch (e) { return jsonResponse(res, 400, { error: 'invalid_json' }); }

  const username = payload.username && String(payload.username).trim();
  const password = payload.password && String(payload.password);
  if (!username || !password) return jsonResponse(res, 400, { error: 'username_and_password_required' });

  const JWT_SECRET = process.env.JWT_SECRET || '';
  if (!JWT_SECRET) return jsonResponse(res, 500, { error: 'jwt_not_configured' });

  try {
    const usersRef = db.collection('users');
    const q = await usersRef.where('username', '==', username).limit(1).get();
    if (q.empty) return jsonResponse(res, 404, { error: 'user_not_found' });
    const doc = q.docs[0];
    const data = doc.data();
    const storedHash = data.passwordHash || '';
    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) return jsonResponse(res, 401, { error: 'invalid_credentials' });
    const token = jwt.sign({ id: doc.id, username }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const userPublic = { id: doc.id, username: data.username, createdAt: data.createdAt };
    return jsonResponse(res, 200, { success: true, token, user: userPublic });
  } catch (e) {
    console.error('[login] error', e && (e.stack || e.message));
    return jsonResponse(res, 500, { error: 'internal_server_error' });
  }
};
