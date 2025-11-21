const { initFirebase, jsonResponse, verifyGetSignature, verifyPostSignature } = require('./_helpers');
const handlePost = require('./_post_handler');
const adminLib = require('firebase-admin');
const { URL } = require('url');

module.exports = async function(req, res){
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, { ok:true });

  // determine subpath after /api/sync
  let pathname = '/';
  try{ pathname = new URL(req.url, 'http://localhost').pathname || '/'; }catch(e){}
  const base = '/api/sync';
  let sub = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  if(!sub || sub === '/') sub = '/';

  // GET /list -> verifyGetSignature then fetch recent sync_items
  if(sub === '/list' && req.method === 'GET'){
    const v = verifyGetSignature(req);
    if(!v.ok) return jsonResponse(res, 401, { error: v.err });
    try { initFirebase(); } catch (e) { console.error('[sync] firebase init error', e && e.message); return jsonResponse(res, 500, { error:'firebase_not_configured' }); }
    const db = require('firebase-admin').firestore();
    try{
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
    }catch(e){ console.error('[sync/list] error', e && (e.stack || e.message)); return jsonResponse(res, 500, { error:'internal_server_error' }); }
  }

  // POST routes: delegate to _post_handler with expectedType
  if(req.method === 'POST'){
    // sub can be '/user' or '/deposit' etc
    const map = {
      '/user': 'user',
      '/deposit': 'deposit',
      '/rate': 'rate',
      '/platform-deposit': 'platform-deposit',
      '/payment-method': 'payment-method',
      '/order': 'order'
    };
    const expected = map[sub];
    if(!expected) return jsonResponse(res, 404, { error:'not_found' });
    // reuse existing sign/verify and post handler
    return handlePost(req, res, expected);
  }

  return jsonResponse(res, 405, { error:'method_not_allowed' });
};
