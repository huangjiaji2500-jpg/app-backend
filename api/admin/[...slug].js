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
          const emsg = e && (e.stack || e.message) || String(e || '');
          console.error('[admin/payments] primary query failed', emsg);
          // If Firestore reports that a composite index is required, return a friendly response
          const urlMatch = emsg.match(/https?:\/\/[^\s)]+/);
          if (emsg.includes('requires an index') || (e && e.code === 9)) {
            const indexUrl = urlMatch ? urlMatch[0] : null;
            return jsonResponse(res, 503, { ok:false, error:'requires_index', indexUrl });
          }
          // fallback: try simpler query (no orderBy)
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

        // normalize payload, support both single- and double-nested shapes
        const originalPayload = targetDoc.data.payload || {};
        const payload = Object.assign({}, originalPayload);
        if(!payload.item && payload.deposit) payload.item = payload.deposit;
        if(!payload.item) payload.item = payload;
        if(!payload.item.item && payload.item && (payload.item.amountRequestedUSDT || payload.item.amountRequested) && (typeof payload.item.item === 'undefined')){
          // preserve existing single-level but allow nested shape where present
        }

        // helper: pick the innermost item that contains amount fields if present
        function resolveNested(item, root){
          const top = item || {};
          const inner = (top && top.item) ? top.item : null;
          return { top, inner };
        }

        const { top: topItem } = resolveNested(payload.item, payload);
        // set status and admin note on top level item
        topItem.status = action;
        if(adminNote) payload.adminNote = adminNote;

        const now = new Date().toISOString();

        // If approving: ensure approved amount is written back to both possible places.
        if(action === 'approved'){
          try{
            const top = payload.item || {};
            const inner = (top && top.item) ? top.item : null;

            // helper to read numeric fields safely
            const readNum = (o, ...keys) => {
              for(const k of keys){ if(o && typeof o[k] !== 'undefined' && o[k] !== null) return Number(o[k]) || 0; }
              return 0;
            };

            const requested = readNum(inner, 'amountRequestedUSDT','amountRequested','amount') || readNum(top, 'amountRequestedUSDT','amountRequested','amount') || readNum(payload, 'amount');
            const approvedExisting = readNum(inner, 'amountApprovedUSDT','amountApproved') || readNum(top, 'amountApprovedUSDT','amountApproved');
            const approved = approvedExisting || 0;

            if(!approved && requested > 0){
              // write into both places if applicable to keep shapes consistent
              if(inner) inner.amountApprovedUSDT = requested;
              top.amountApprovedUSDT = requested;
              // also keep canonical amount fields aligned
              if(inner) inner.amount = requested;
              top.amount = requested;
              payload.amount = requested;
            }
          }catch(e){ console.error('[admin][payments] compute approved fallback error', e && e.message); }
        }

        // Use a transaction so sync_items update and user balance increment are atomic
        try{
          if(action === 'approved'){
            await db.runTransaction(async tx => {
              // re-read current doc inside transaction
              const snap = await tx.get(targetDoc.ref);
              if(!snap.exists) throw new Error('doc_missing_in_tx');
              const cur = snap.data() || {};
              // merge our payload into current payload to avoid stomping unrelated changes
              const mergedPayload = Object.assign({}, cur.payload || {}, payload);

              // ensure nested fields are present and consistent
              if(mergedPayload.item && mergedPayload.item.item){
                // prefer inner approved if present; otherwise ensure both have the approved value
                const inner = mergedPayload.item.item;
                const top = mergedPayload.item;
                const getNum = (o, ...keys) => { for(const k of keys) if(o && typeof o[k] !== 'undefined' && o[k] !== null) return Number(o[k])||0; return 0; };
                const resolvedAmount = getNum(inner, 'amountApprovedUSDT','amountApproved','amount') || getNum(top, 'amountApprovedUSDT','amountApproved','amount') || getNum(mergedPayload,'amount');
                if(resolvedAmount && (!getNum(inner,'amountApprovedUSDT','amountApproved'))){ inner.amountApprovedUSDT = resolvedAmount; inner.amount = resolvedAmount; }
                if(resolvedAmount && (!getNum(top,'amountApprovedUSDT','amountApproved'))){ top.amountApprovedUSDT = resolvedAmount; top.amount = resolvedAmount; }
                mergedPayload.amount = mergedPayload.amount || resolvedAmount;
              } else if(mergedPayload.item){
                const top = mergedPayload.item;
                const resolvedAmount = Number(top.amountApprovedUSDT || top.amountApproved || top.amount || top.amountRequestedUSDT || top.amountRequested || mergedPayload.amount) || 0;
                if(resolvedAmount){ top.amountApprovedUSDT = top.amountApprovedUSDT || resolvedAmount; top.amount = top.amount || resolvedAmount; mergedPayload.amount = mergedPayload.amount || resolvedAmount; }
              }

              tx.update(targetDoc.ref, { payload: mergedPayload, updatedAt: now });

              // resolve username and amount for balance increment
              const topForUser = (mergedPayload.item && mergedPayload.item.item) ? mergedPayload.item.item : mergedPayload.item || mergedPayload;
              const username = (topForUser && (topForUser.username || mergedPayload.username)) || '';
              const amount = Number(topForUser.amountApprovedUSDT || topForUser.amountApproved || topForUser.amount || topForUser.amountRequestedUSDT || topForUser.amountRequested || mergedPayload.amount) || 0;
              console.log('[admin][payments] approving (tx)', { docId: targetDoc.ref.id, username, amount });
              if(username && amount > 0){
                const usersRef = db.collection('users');
                const q = await tx.get(usersRef.where('username','==',username).limit(1));
                if(!q.empty){ const udoc = q.docs[0]; tx.update(usersRef.doc(udoc.id), { topupBalance: adminLib.firestore.FieldValue.increment(amount), updatedAt: now }); }
                else { tx.set(db.collection('user_balances').doc(username), { username, topupBalance: amount, updatedAt: now }, { merge: true }); }
              } else {
                console.warn('[admin][payments] no username or zero amount, skip balance update', { username, amount });
              }
            });
          } else {
            if(action === 'delete'){
              // delete the record
              await targetDoc.ref.delete();
            } else {
              // non-approved actions: simple update (e.g., rejected)
              await targetDoc.ref.update({ payload, updatedAt: now });
            }
          }
        }catch(e){ console.error('[admin][payments] transaction error', e && (e.stack || e.message)); }

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
