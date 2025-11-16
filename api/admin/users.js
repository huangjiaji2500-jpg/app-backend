const { getFirestore } = require('../../lib/firestore');

module.exports = async (req, res) => {
  const method = req.method;
  // allow GET for listing and PATCH for modifications
  if (!['GET','PATCH'].includes(method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const headerSecret = (req.headers['x-admin-secret'] || '').toString();
  const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
  if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
  if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  try {
    const db = getFirestore();
    if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
    // If an id query parameter is provided, return single user detail
    const id = req.query && (req.query.id || req.query.userId);
    if (id) {
      const doc = await db.collection('users').doc(String(id)).get();
      if (!doc.exists) return res.status(404).json({ ok: false, error: 'user not found' });
      return res.status(200).json({ ok: true, user: { id: doc.id, ...doc.data() } });
    }
    // If PATCH: perform admin actions (modify role / disable / reset password)
    if (method === 'PATCH') {
      try {
            const body = req.body || {};
            const targetId = body.id || body.userId;
        if (!targetId) return res.status(400).json({ ok: false, error: 'id required' });
        const userRef = db.collection('users').doc(String(targetId));
        const doc = await userRef.get();
        if (!doc.exists) return res.status(404).json({ ok: false, error: 'user not found' });

            // We'll prepare two objects:
            // - dbUpdate: fields that will be written to DB (must NOT contain plaintext temp)
            // - respUpdate: fields we send back in API response (may include plaintext temp)
            const dbUpdate = {};
            const respUpdate = {};
            if (body.role) { dbUpdate.role = body.role; respUpdate.role = body.role; }
            if (typeof body.disabled !== 'undefined') { dbUpdate.disabled = !!body.disabled; respUpdate.disabled = !!body.disabled; }
            // resetPassword action: generate temp password and mark mustChangePassword
            if (body.resetPassword === true || body.action === 'resetPassword') {
              // generate simple temp password (8 chars)
              const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
              let temp = '';
              for (let i=0;i<8;i++) temp += chars[Math.floor(Math.random()*chars.length)];
              // hash the temp password before storing
              const crypto = require('crypto');
              const salt = crypto.randomBytes(16).toString('hex');
              // use scrypt (node built-in) to derive a key
              const derivedKey = crypto.scryptSync(temp, salt, 64).toString('hex');
              const storedHash = `${salt}$${derivedKey}`;
              dbUpdate.mustChangePassword = true;
              dbUpdate.tempPasswordHash = storedHash; // stored in DB
              // response should still include plaintext for admin to copy (only returned, not stored)
              respUpdate.mustChangePassword = true;
              respUpdate.tempPassword = temp;
            }

            // merge into Firestore (write dbUpdate)
            await userRef.set(dbUpdate, { merge: true });

        // try best-effort to update MongoDB users collection if configured
        try {
          const uri = process.env.MONGODB_URI;
          if (uri) {
            const { MongoClient, ObjectId } = require('mongodb');
            const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
            await client.connect();
            const dbName = process.env.MONGODB_DB || 'usdt_trading';
            const mdb = client.db(dbName);
            const col = mdb.collection('users');
            const filter = {};
            // if id looks like ObjectId, use that, else try _id as string
            if (/^[0-9a-fA-F]{24}$/.test(String(targetId))) {
              try { filter._id = new ObjectId(String(targetId)); } catch(e){ filter._id = String(targetId); }
            } else {
              filter._id = String(targetId);
            }
            const mongoUpdate = { $set: {} };
            if (dbUpdate.role) mongoUpdate.$set.role = dbUpdate.role;
            if (typeof dbUpdate.disabled !== 'undefined') mongoUpdate.$set.disabled = dbUpdate.disabled;
            if (dbUpdate.mustChangePassword) mongoUpdate.$set.mustChangePassword = dbUpdate.mustChangePassword;
            if (dbUpdate.tempPasswordHash) mongoUpdate.$set.tempPasswordHash = dbUpdate.tempPasswordHash;
            // only run if there is something to set
            if (Object.keys(mongoUpdate.$set).length) {
              await col.updateOne(filter, mongoUpdate, { upsert: false });
            }
            await client.close();
          }
        } catch (e) {
          console.warn('[admin/users] mongo sync failed', e && (e.stack || e.message));
        }

  return res.status(200).json({ ok: true, id: targetId, update: respUpdate });
      } catch (err) {
        console.error('[admin/users][patch] error', err && (err.stack || err.message));
        return res.status(500).json({ ok: false, error: 'patch failed' });
      }
    }

    const q = await db.collection('users').orderBy('createdAt', 'desc').limit(200).get();
    const users = [];
    q.forEach(d => users.push({ id: d.id, ...d.data() }));
    return res.status(200).json({ ok: true, count: users.length, users });
  } catch (e) {
    console.error('[admin/users] error', e && (e.stack || e.message));
    return res.status(500).json({ ok: false, error: 'internal' });
  }
};
