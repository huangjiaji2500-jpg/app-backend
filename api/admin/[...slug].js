const lib = require('../../lib/firestore');
const adminLib = require('firebase-admin');
const bcrypt = require('bcryptjs');
const setPlatformHandler = require('../../set-platform-config');
const { URL } = require('url');

function jsonResponse(res, statusCode, body){
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, x-admin-secret');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS');
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

  // determine subpath after /api/admin
  let pathname = '/';
  try{ pathname = new URL(req.url, 'http://localhost').pathname || '/'; }catch(e){}
  // remove leading /api/admin
  const base = '/api/admin';
  let sub = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  if(!sub || sub === '/') sub = '/';

  // route: / (not used) -> 405
  // route: /set-platform-config -> delegate to root handler (POST)
  if(sub === '/set-platform-config'){
    // reuse existing handler which expects (req,res)
    return setPlatformHandler(req, res);
  }

  // For other admin routes require admin secret
  const chk = checkAdmin(req);
  if(!chk.ok) return jsonResponse(res, chk.err === 'server_misconfigured' ? 500 : 401, { ok:false, error: chk.err });

  // init firestore
  const db = lib.getFirestore();
  if(!db) return jsonResponse(res, 500, { ok:false, error:'firebase_not_configured' });

  try{
    if(sub === '/payments' || sub === '/payments/'){
      if(req.method === 'GET'){
        try {
          const q = db.collection('sync_items').where('type','==','deposit').orderBy('receivedAt','desc').limit(500);
          const snap = await q.get();
          const items = [];
          snap.forEach(d => items.push(Object.assign({ _id: d.id }, d.data())));
          return jsonResponse(res, 200, { ok:true, payments: items });
        } catch(e) {
          // fallback: if orderBy causes issues (missing field/index), try simpler query
          console.error('[admin/payments] primary query failed', e && (e.stack || e.message));
          try {
            const q2 = db.collection('sync_items').where('type','==','deposit').limit(500);
            const snap2 = await q2.get();
            const items2 = [];
            snap2.forEach(d => items2.push(Object.assign({ _id: d.id }, d.data())));
            return jsonResponse(res, 200, { ok:true, payments: items2, debugFallback: true });
          } catch(err2) {
            console.error('[admin/payments] fallback query failed', err2 && (err2.stack || err2.message));
            return jsonResponse(res, 500, { ok:false, error:'query_failed', message: (err2 && (err2.message || String(err2))) });
          }
        }
      }
      if(req.method === 'PATCH'){
        let body = req.body || {};
        try { body = (typeof body === 'object') ? body : JSON.parse(body); } catch(e){ }
        const { id, action, adminNote } = body || {};
        if(!id || !action) return jsonResponse(res, 400, { ok:false, error:'id_and_action_required' });

        // find doc
        let docRef = db.collection('sync_items').doc(id);
        let docSnap = await docRef.get();
        let targetDoc = null;
        if(docSnap.exists) targetDoc = { ref: docRef, data: docSnap.data() };
        else {
          const q1 = await db.collection('sync_items').where('payload.item.id','==',id).limit(1).get();
          if(!q1.empty){ const d = q1.docs[0]; targetDoc = { ref: db.collection('sync_items').doc(d.id), data: d.data() }; }
          else {
            const q2 = await db.collection('sync_items').where('payload.id','==',id).limit(1).get();
            if(!q2.empty){ const d = q2.docs[0]; targetDoc = { ref: db.collection('sync_items').doc(d.id), data: d.data() }; }
          }
        }
        if(!targetDoc) return jsonResponse(res, 404, { ok:false, error:'not_found' });

        const payload = targetDoc.data.payload || {};
        if(!payload.item && payload.deposit) payload.item = payload.deposit;
        if(!payload.item) payload.item = payload;
        payload.item.status = action;
        if(adminNote) payload.adminNote = adminNote;
        const updateObj = { payload, updatedAt: new Date().toISOString() };
        await targetDoc.ref.update(updateObj);

        if(action === 'approved'){
          try{
            const item = payload.item || {};
            const username = item.username || payload.username || '';
            const amount = Number(item.amountApprovedUSDT || item.amountApproved || item.amount || 0) || 0;
            if(username && amount > 0){
              const usersRef = db.collection('users');
              const q = await usersRef.where('username','==',username).limit(1).get();
              if(!q.empty){ const udoc = q.docs[0]; await usersRef.doc(udoc.id).update({ topupBalance: adminLib.firestore.FieldValue.increment(amount), updatedAt: new Date().toISOString() }); }
              else { await db.collection('user_balances').doc(username).set({ username, topupBalance: amount, updatedAt: new Date().toISOString() }, { merge: true }); }
            }
          }catch(e){ console.error('[admin][payments] balance update error', e && e.message); }
        }

        return jsonResponse(res, 200, { ok:true });
      }
      return jsonResponse(res, 405, { ok:false, error:'method_not_allowed' });
    }

    if(sub === '/users' || sub === '/users/'){
      if(req.method === 'GET'){
        const id = (new URL(req.url, 'http://localhost')).searchParams.get('id') || null;
        if(id){
          const doc = await db.collection('users').doc(id).get();
          if(doc.exists) return jsonResponse(res, 200, { ok:true, user: Object.assign({ id: doc.id }, doc.data()) });
          const q = await db.collection('users').where('username','==',id).limit(1).get();
          if(!q.empty) return jsonResponse(res, 200, { ok:true, user: Object.assign({ id: q.docs[0].id }, q.docs[0].data()) });
          return jsonResponse(res, 404, { ok:false, error:'not_found' });
        }
        const snap = await db.collection('users').orderBy('createdAt','desc').limit(500).get();
        const users = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        return jsonResponse(res, 200, { ok:true, users, count: users.length });
      }
      if(req.method === 'PATCH'){
        let body = req.body || {};
        try { body = (typeof body === 'object') ? body : JSON.parse(body); } catch(e){}
        const { id, disabled, resetPassword } = body || {};
        if(!id) return jsonResponse(res, 400, { ok:false, error:'id_required' });

        const usersRef = db.collection('users');
        let docRef = usersRef.doc(id);
        let docSnap = await docRef.get();
        if(!docSnap.exists){
          const q = await usersRef.where('username','==',id).limit(1).get();
          if(!q.empty){ docRef = usersRef.doc(q.docs[0].id); docSnap = q.docs[0]; }
        }
        if(!docSnap || !docSnap.exists) return jsonResponse(res, 404, { ok:false, error:'not_found' });

        const updates = { updatedAt: new Date().toISOString() };
        const result = {};
        if(typeof disabled !== 'undefined') updates.disabled = !!disabled;
        if(resetPassword){
          const tmp = Math.random().toString(36).slice(-10) + Math.floor(Math.random()*9000+1000);
          const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10) || 10;
          const hash = await bcrypt.hash(tmp, rounds);
          updates.passwordHash = hash;
          result.tempPassword = tmp;
        }
        await docRef.update(updates);
        return jsonResponse(res, 200, { ok:true, update: result });
      }
      return jsonResponse(res, 405, { ok:false, error:'method_not_allowed' });
    }

    // unknown route under admin
    return jsonResponse(res, 404, { ok:false, error:'not_found' });
  }catch(e){
    console.error('[api/admin][...slug] error', e && (e.stack || e.message));
    return jsonResponse(res, 500, { ok:false, error:'internal_error' });
  }
};
