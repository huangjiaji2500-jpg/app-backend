const lib = require('../../lib/firestore');
const bcrypt = require('bcryptjs');

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
      const id = (req.query && req.query.id) || (req.url && (new URL(req.url, 'http://localhost')).searchParams.get('id')) || null;
      if(id){
        // try doc id
        const doc = await db.collection('users').doc(id).get();
        if(doc.exists) return jsonResponse(res, 200, { ok:true, user: Object.assign({ id: doc.id }, doc.data()) });
        // try username
        const q = await db.collection('users').where('username','==',id).limit(1).get();
        if(!q.empty) return jsonResponse(res, 200, { ok:true, user: Object.assign({ id: q.docs[0].id }, q.docs[0].data()) });
        return jsonResponse(res, 404, { ok:false, error:'not_found' });
      }

      // list users (limited)
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
      // find doc by id or username
      let docRef = usersRef.doc(id);
      let docSnap = await docRef.get();
      if(!docSnap.exists){
        const q = await usersRef.where('username','==',id).limit(1).get();
        if(!q.empty){ docRef = usersRef.doc(q.docs[0].id); docSnap = q.docs[0]; }
      }
      if(!docSnap || !docSnap.exists) return jsonResponse(res, 404, { ok:false, error:'not_found' });

      const updates = { updatedAt: new Date().toISOString() };
      const result = {};
      if(typeof disabled !== 'undefined'){
        updates.disabled = !!disabled;
      }
      if(resetPassword){
        // generate temp password and update passwordHash
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
  }catch(e){
    console.error('[api/admin/users] error', e && (e.stack || e.message));
    return jsonResponse(res, 500, { ok:false, error:'internal_error' });
  }
};
