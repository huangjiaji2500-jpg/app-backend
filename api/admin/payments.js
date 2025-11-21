const lib = require('../../lib/firestore');
const adminLib = require('firebase-admin');

function jsonResponse(res, statusCode, body){
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, x-admin-secret');
  res.setHeader('Access-Control-Allow-Methods','GET, PATCH, OPTIONS');
  res.statusCode = statusCode;
  return res.end(JSON.stringify(body));
}

function checkAdmin(req){
  const headerSecret = (req.headers['x-admin-secret'] || '').toString();
  const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET || '';
  if(!envSecret) return { ok:false, err:'server_misconfigured' };
  if(!headerSecret || headerSecret !== envSecret) return { ok:false, err:'unauthorized' };
  return { ok:true };
}

module.exports = async function(req, res){
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, { ok:true });

  const chk = checkAdmin(req);
  if(!chk.ok) return jsonResponse(res, chk.err === 'server_misconfigured' ? 500 : 401, { ok:false, error: chk.err });

  const db = lib.getFirestore();
  if(!db) return jsonResponse(res, 500, { ok:false, error:'firebase_not_configured' });

  try{
    if(req.method === 'GET'){
      // list recent deposit-type sync_items
      let q = db.collection('sync_items').where('type','==','deposit').orderBy('receivedAt','desc').limit(500);
      const snap = await q.get();
      const items = [];
      snap.forEach(d => {
        const dd = d.data();
        items.push(Object.assign({ _id: d.id }, dd));
      });
      return jsonResponse(res, 200, { ok:true, payments: items });
    }

    if(req.method === 'PATCH'){
      let body = req.body || {};
      try { body = (typeof body === 'object') ? body : JSON.parse(body); } catch(e){ }
      const { id, action, adminNote } = body || {};
      if(!id || !action) return jsonResponse(res, 400, { ok:false, error:'id_and_action_required' });

      // try direct doc id
      const docRef = db.collection('sync_items').doc(id);
      const docSnap = await docRef.get();
      let targetDoc = null;
      if(docSnap.exists) targetDoc = { ref: docRef, data: docSnap.data() };
      else {
        // fallback: find by payload.item.id or payload.id
        const q = await db.collection('sync_items').where('payload.item.id','==',id).limit(1).get();
        if(!q.empty){ const d = q.docs[0]; targetDoc = { ref: db.collection('sync_items').doc(d.id), data: d.data() }; }
        else {
          const q2 = await db.collection('sync_items').where('payload.id','==',id).limit(1).get();
          if(!q2.empty){ const d = q2.docs[0]; targetDoc = { ref: db.collection('sync_items').doc(d.id), data: d.data() }; }
        }
      }

      if(!targetDoc) return jsonResponse(res, 404, { ok:false, error:'not_found' });

      // update status fields
      const now = Date.now();
      const updateObj = {};
      // try to set payload.item.status and payload.adminNote and updatedAt
      const payload = targetDoc.data.payload || {};
      if(!payload.item && payload.deposit) payload.item = payload.deposit;
      if(!payload.item) payload.item = payload;
      payload.item.status = action;
      if(adminNote) payload.adminNote = adminNote;
      updateObj.payload = payload;
      updateObj.updatedAt = new Date().toISOString();

      await targetDoc.ref.update(updateObj);

      // if approved, try to increment user topup balance
      if(action === 'approved'){
        try{
          const item = payload.item || {};
          const username = item.username || payload.username || '';
          const amount = Number(item.amountApprovedUSDT || item.amountApproved || item.amount || 0) || 0;
          if(username && amount > 0){
            const usersRef = db.collection('users');
            const q = await usersRef.where('username','==',username).limit(1).get();
            if(!q.empty){
              const udoc = q.docs[0];
              await usersRef.doc(udoc.id).update({ topupBalance: adminLib.firestore.FieldValue.increment(amount), updatedAt: new Date().toISOString() });
            } else {
              await db.collection('user_balances').doc(username).set({ username, topupBalance: amount, updatedAt: new Date().toISOString() }, { merge: true });
            }
          }
        }catch(e){ console.error('[admin/payments] balance update error', e && e.message); }
      }

      return jsonResponse(res, 200, { ok:true });
    }

    return jsonResponse(res, 405, { ok:false, error:'method_not_allowed' });
  }catch(e){
    console.error('[api/admin/payments] error', e && (e.stack || e.message));
    return jsonResponse(res, 500, { ok:false, error:'internal_error' });
  }
};
