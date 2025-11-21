const libHelpers = require('./sync_helpers');
const adminLib = require('firebase-admin');

async function handlePost(req, res, expectedType){
  if (req.method === 'OPTIONS') return libHelpers.jsonResponse(res, 200, { ok:true });
  if (req.method !== 'POST') return libHelpers.jsonResponse(res, 405, { error: 'method_not_allowed' });

  let payload = {};
  try { payload = req.body ? (typeof req.body === 'object' ? req.body : JSON.parse(req.body)) : {}; } catch (e) { return libHelpers.jsonResponse(res, 400, { error:'invalid_json' }); }

  const v = await libHelpers.verifyPostSignature(req, payload);
  if (!v.ok) return libHelpers.jsonResponse(res, 401, { error: v.err });

  try { libHelpers.initFirebase(); } catch (e) { console.error('[sync] firebase init error', e && e.message); return libHelpers.jsonResponse(res, 500, { error:'firebase_not_configured' }); }
  const db = require('firebase-admin').firestore();

  try {
    const now = Date.now();
    const doc = {
      type: expectedType,
      data: payload[ expectedType === 'platform-deposit' ? 'platformDeposit' : (expectedType === 'payment-method' ? 'paymentMethod' : expectedType) ] || payload,
      payload,
      ts: payload.ts || now,
      receivedAt: now
    };
    await db.collection('sync_items').add(doc);
    // If this is a deposit approval coming from an admin device, update user's top-up balance in Firestore
    try {
      if (expectedType === 'deposit' && payload && (payload.action === 'approve' || (payload.item && payload.item.status === 'approved'))) {
        const item = payload.item || payload.deposit || {};
        const username = item.username || payload.username || (item.data && item.data.username) || '';
        const amount = Number(item.amountApprovedUSDT || item.amountApproved || 0) || 0;
        if (username && amount > 0) {
          try {
            const usersRef = db.collection('users');
            const q = await usersRef.where('username', '==', username).limit(1).get();
            if (!q.empty) {
              const udoc = q.docs[0];
              // atomic increment topupBalance
              await usersRef.doc(udoc.id).update({ topupBalance: adminLib.firestore.FieldValue.increment(amount), updatedAt: new Date().toISOString() });
            } else {
              // user not found: create a lightweight record in user_balances collection
              await db.collection('user_balances').doc(username).set({ username, topupBalance: amount, updatedAt: new Date().toISOString() }, { merge: true });
            }
          } catch (e) {
            console.error('[sync] update user balance error', e && (e.stack || e.message));
          }
        }
      }
    } catch (e) {
      console.error('[sync] approve-handling error', e && (e.stack || e.message));
    }
    return libHelpers.jsonResponse(res, 200, { ok:true });
  } catch (e) {
    console.error('[sync] write error', e && (e.stack || e.message));
    return libHelpers.jsonResponse(res, 500, { error:'internal_server_error' });
  }
}

module.exports = handlePost;
