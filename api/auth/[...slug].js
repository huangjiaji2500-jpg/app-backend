const adminLib = require('firebase-admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { URL } = require('url');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.statusCode = statusCode;
  return res.end(JSON.stringify(body));
}

module.exports = async function(req, res){
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, { ok:true });

  // determine subpath after /api/auth
  let pathname = '/';
  try{ pathname = new URL(req.url, 'http://localhost').pathname || '/'; }catch(e){}
  const base = '/api/auth';
  let sub = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  if(!sub || sub === '/') sub = '/';

  try { initFirebase(); } catch (e) { console.error('[api/auth] firebase init error', e && e.message); return jsonResponse(res, 500, { error:'firebase_not_configured' }); }
  const db = adminLib.firestore();

  // GET /auth/check-username?username=...
  if (sub === '/check-username' && req.method === 'GET'){
    try{
      const q = (new URL(req.url, 'http://localhost')).searchParams.get('username') || '';
      if(!q) return jsonResponse(res, 400, { error:'username_required' });
      const snap = await db.collection('users').where('username','==',q).limit(1).get();
      return jsonResponse(res, 200, { available: snap.empty });
    } catch(e){ console.error('[auth/check-username] error', e && e.message); return jsonResponse(res, 500, { error:'internal' }); }
  }

  // POST routes
  if (req.method === 'POST'){
    let body = {};
    try { body = req.body ? (typeof req.body === 'object' ? req.body : JSON.parse(req.body)) : {}; } catch (e) { return jsonResponse(res, 400, { error:'invalid_json' }); }

    // register via firebaseUid (used by client fallback)
    if (sub === '/register-firebase'){
      const username = body.username && String(body.username).trim();
      const firebaseUid = body.firebaseUid && String(body.firebaseUid).trim();
      if(!username || !firebaseUid) return jsonResponse(res, 400, { error:'username_and_firebaseUid_required' });
      const JWT_SECRET = process.env.JWT_SECRET || '';
      if(!JWT_SECRET) return jsonResponse(res, 500, { error:'jwt_not_configured' });
      try{
        const usersRef = db.collection('users');
        const q = await usersRef.where('username','==',username).limit(1).get();
        if(!q.empty) return jsonResponse(res, 409, { error:'username_taken' });
        const now = new Date().toISOString();
        const doc = { username, firebaseUid, createdAt: now, updatedAt: now };
        const added = await usersRef.add(doc);
        const token = jwt.sign({ id: added.id, username }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        return jsonResponse(res, 200, { success:true, token, user: { id: added.id, username, createdAt: now } });
      } catch(e){ console.error('[auth/register-firebase] error', e && e.message); return jsonResponse(res, 500, { error:'internal' }); }
    }

    // register-local -> delegate to existing api/register if password provided
    if (sub === '/register-local'){
      // reuse api/register handler if present
      try{
        const registerHandler = require('../register');
        return registerHandler(req, res);
      } catch(e){ console.error('[auth/register-local] delegate failed', e && e.message); return jsonResponse(res, 500, { error:'delegate_failed' }); }
    }

    // login-firebase: lookup by firebaseUid and return JWT
    if (sub === '/login-firebase'){
      const firebaseUid = body.firebaseUid && String(body.firebaseUid).trim();
      if(!firebaseUid) return jsonResponse(res, 400, { error:'firebaseUid_required' });
      const JWT_SECRET = process.env.JWT_SECRET || '';
      if(!JWT_SECRET) return jsonResponse(res, 500, { error:'jwt_not_configured' });
      try{
        const q = await db.collection('users').where('firebaseUid','==',firebaseUid).limit(1).get();
        if(q.empty) return jsonResponse(res, 404, { error:'user_not_found' });
        const doc = q.docs[0];
        const data = doc.data();
        const token = jwt.sign({ id: doc.id, username: data.username }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        return jsonResponse(res, 200, { success:true, token, user: { id: doc.id, username: data.username } });
      } catch(e){ console.error('[auth/login-firebase] error', e && e.message); return jsonResponse(res, 500, { error:'internal' }); }
    }

    // login-local or login-temp -> delegate to /api/login
    if (sub === '/login-local' || sub === '/login-temp'){
      try{
        const loginHandler = require('../login');
        return loginHandler(req, res);
      } catch(e){ console.error('[auth/login-local] delegate failed', e && e.message); return jsonResponse(res, 500, { error:'delegate_failed' }); }
    }

    // change-temp-password -> not implemented here
    if (sub === '/change-temp-password'){
      return jsonResponse(res, 501, { error:'not_implemented' });
    }

    return jsonResponse(res, 404, { error:'not_found' });
  }

  return jsonResponse(res, 405, { error:'method_not_allowed' });
};
