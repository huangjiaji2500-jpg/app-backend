const { initFirebase, jsonResponse } = require('../../lib/sync_helpers');

module.exports = async function(req, res){
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, { ok:true });
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method_not_allowed' });
  try { initFirebase(); } catch (e) { console.error('[public/platform-config] firebase init error', e && e.message); return jsonResponse(res, 500, { error:'firebase_not_configured' }); }
  const db = require('firebase-admin').firestore();
  try {
    // gather displayRates from latest 'rate' sync items
    const col = db.collection('sync_items');
    const snaps = await col.orderBy('receivedAt','desc').limit(500).get();
    const items = snaps.docs.map(d=>d.data());
    const rates = items.filter(i=>i.type === 'rate').map(i=>i.data||{});
    const paymentMethods = items.filter(i=>i.type === 'payment-method').map(i=>i.data||{});
    let platformDeposit = items.filter(i=>i.type === 'platform-deposit').map(i=>i.data||{}).slice(0,1)[0] || null;
    // build displayRates simple map (client expects USD,CNY,KRW,JPY possibly)
    const displayRates = {};
    for (const r of rates){
      try {
        const base = (r.base||'').toString().toUpperCase();
        const quote = (r.quote||'').toString().toUpperCase();
        const val = Number(r.value);
        if (isNaN(val) || val <= 0) continue;
        if (quote === 'CNY') displayRates.CNY = val;
        else if (quote === 'KRW') displayRates.KRW = val;
        else if (quote === 'JPY') displayRates.JPY = val;
        else if (quote === 'USD') displayRates.USD = val;
      } catch(e){ }
    }
    const debug = { source:'firestore', envHasFirestore: true };
    // If we didn't find a platform-deposit in sync_items, fallback to legacy platform doc
    if (!platformDeposit) {
      try {
        const doc = await db.doc('platform/platform').get();
        if (doc.exists) {
          const d = doc.data() || {};
          if (d.platformDeposit) { platformDeposit = d.platformDeposit; debug.source = 'platform_doc'; }
        }
      } catch (e) {
        // ignore fallback errors
      }
    }
    return jsonResponse(res, 200, { ok:true, displayRates, platformDeposit, paymentMethods, debug });
  } catch (e) {
    console.error('[public/platform-config] error', e && (e.stack || e.message));
    return jsonResponse(res, 500, { error:'internal_server_error' });
  }
};
