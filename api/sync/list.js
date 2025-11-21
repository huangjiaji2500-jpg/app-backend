const { initFirebase, jsonResponse, verifyGetSignature } = require('./_helpers');

module.exports = async function(req, res){
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, { ok:true });
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method_not_allowed' });
  // verify signature
  const v = verifyGetSignature(req);
  if (!v.ok) return jsonResponse(res, 401, { error: v.err });

  try {
    initFirebase();
  } catch (e) { console.error('[sync/list] firebase init error', e && e.message); return jsonResponse(res, 500, { error:'firebase_not_configured' }); }
  const db = require('firebase-admin').firestore();

  try {
    const col = db.collection('sync_items');
    const snapshot = await col.orderBy('receivedAt','desc').limit(200).get();
    const items = snapshot.docs.map(d=>({ id:d.id, ...d.data() }));
    const orders = items.filter(i=>i.type === 'order').map(i=>i.data || {});
    const deposits = items.filter(i=>i.type === 'deposit').map(i=>i.data || {});
    const users = items.filter(i=>i.type === 'user').map(i=>i.data || {});
    const rates = items.filter(i=>i.type === 'rate').map(i=>i.data || {});
    const paymentMethods = items.filter(i=>i.type === 'payment-method').map(i=>i.data || {});
    const platformDeposit = items.filter(i=>i.type === 'platform-deposit').map(i=>i.data || {}).slice(0,1)[0] || null;
    return jsonResponse(res, 200, { ok:true, orders, deposits, users, rates, paymentMethods, platformDeposit });
  } catch (e) {
    console.error('[sync/list] error', e && (e.stack || e.message));
    return jsonResponse(res, 500, { error:'internal_server_error' });
  }
};
