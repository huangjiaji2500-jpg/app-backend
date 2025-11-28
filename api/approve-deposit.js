const adminLib = require('firebase-admin');
const jwt = require('jsonwebtoken');
const fs = require('fs');

function initFirebase() {
  if (adminLib.apps && adminLib.apps.length) return adminLib.app();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(json);
    return adminLib.initializeApp({ credential: adminLib.credential.cert(serviceAccount) });
  }
  // fallback to local key file (for staging/local runs)
  const p = require('path').resolve(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(p)) {
    const serviceAccount = require(p);
    return adminLib.initializeApp({ credential: adminLib.credential.cert(serviceAccount) });
  }
  throw new Error('FIREBASE_SERVICE_ACCOUNT env not set and serviceAccountKey.json not found');
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

  try { initFirebase(); } catch (e) { console.error('[approve-deposit] firebase init error', e && e.message); return jsonResponse(res, 500, { error: 'firebase_not_configured' }); }
  const db = adminLib.firestore();
  const FieldValue = adminLib.firestore.FieldValue;

  // auth
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) return jsonResponse(res, 401, { error: 'missing_authorization' });
  const token = auth.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || '';
  if (!JWT_SECRET) return jsonResponse(res, 500, { error: 'jwt_not_configured' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const adminId = decoded && decoded.id;
    if (!adminId) return jsonResponse(res, 401, { error: 'invalid_token' });

    // ensure admin
    const adminDoc = await db.collection('users').doc(adminId).get();
    if (!adminDoc.exists) return jsonResponse(res, 403, { error: 'admin_not_found' });
    const adminData = adminDoc.data() || {};
    if (!adminData.isAdmin) return jsonResponse(res, 403, { error: 'forbidden_not_admin' });

    const body = req.body || {};
    const docId = body.docId || body.id;
    const username = body.username;
    const amount = Number(body.amount || 0);
    if (!docId || !username || !amount) return jsonResponse(res, 400, { error: 'missing_parameters' });

    const docRef = db.collection('sync_items').doc(docId);

    // capture pre-snapshot
    const preSnap = await docRef.get();
    if (!preSnap.exists) return jsonResponse(res, 404, { error: 'sync_item_not_found' });
    const preData = preSnap.data();

    // Run transaction: prevent double-approval
    const timestamp = new Date().toISOString();
    try {
      await db.runTransaction(async (t) => {
        const d = await t.get(docRef);
        if (!d.exists) throw new Error('sync_items doc disappeared');
        const data = d.data() || {};
        const payload = data.payload || data.data || {};
        payload.item = payload.item || {};
        payload.item.item = payload.item.item || {};

        // If already approved, abort
        const already = (payload.item && payload.item.status === 'approved') || (payload.status === 'approved') || (payload.item && Number(payload.item.amountApprovedUSDT) > 0);
        if (already) throw new Error('already_approved');

        // set approved amount in nested locations
        payload.item.amountApprovedUSDT = amount;
        payload.item.item.amountApprovedUSDT = amount;
        if (!payload.item.amount) payload.item.amount = amount;
        if (!payload.item.item.amount) payload.item.item.amount = amount;
        payload.item.status = 'approved';
        payload.item.item.status = 'approved';

        const updateObj = { payload, updatedAt: timestamp };
        t.update(docRef, updateObj);

        // increment user balance
        const usersRef = db.collection('users');
        const userBalancesRef = db.collection('user_balances');
        const q = await usersRef.where('username', '==', username).limit(1).get();
        if (!q.empty) {
          const udoc = q.docs[0]; const uref = usersRef.doc(udoc.id);
          t.update(uref, { topupBalance: FieldValue.increment(amount), updatedAt: timestamp });
        } else {
          const ubRef = userBalancesRef.doc(username);
          // use increment where supported
          t.set(ubRef, { username, topupBalance: FieldValue.increment ? FieldValue.increment(amount) : amount, updatedAt: timestamp }, { merge: true });
        }
      });
    } catch (e) {
      if (e && e.message === 'already_approved') return jsonResponse(res, 409, { error: 'already_approved' });
      console.error('[approve-deposit] transaction failed', e && e.stack || e);
      return jsonResponse(res, 500, { error: 'transaction_failed', detail: (e && e.message) });
    }

    // read post snapshot
    const postSnap = await docRef.get();
    const postData = postSnap.exists ? postSnap.data() : null;
    // find post user data
    let postUserData = null; let userPath = null;
    const q2 = await db.collection('users').where('username','==',username).limit(1).get();
    if (!q2.empty) { postUserData = q2.docs[0].data(); userPath = `users/${q2.docs[0].id}`; }
    else { const ub2 = await db.collection('user_balances').doc(username).get(); if (ub2.exists) { postUserData = ub2.data(); userPath = `user_balances/${username}`; } }

    // store audit record in admin_audit
    const auditRec = {
      action: 'approve_deposit',
      docId, username, amount, timestamp: new Date().toISOString(),
      adminId, adminUsername: adminData.username || null,
      pre: preData || null,
      post: postData || null,
      postUser: postUserData || null,
      postUserPath: userPath || null
    };
    try { await db.collection('admin_audit').add(auditRec); } catch (e) { console.warn('[approve-deposit] audit write failed', e && e.message); }

    return jsonResponse(res, 200, { success: true, pre: preData, post: postData, postUser: postUserData });
  } catch (e) {
    console.error('[approve-deposit] error', e && (e.stack || e.message));
    return jsonResponse(res, 401, { error: 'invalid_token_or_expired' });
  }
};
