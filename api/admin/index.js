export default async function handler(req, res) {
  const action = req.query.action;

  // ========== payments.js ==========
  if (action === 'payments') {
    const { getFirestore } = require('../../lib/firestore');
    const headerSecret = (req.headers['x-admin-secret'] || '').toString();
    const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
    if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
    if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
      const admin = require('firebase-admin');
      if (req.method === 'GET') {
        const q = await db.collection('payments').orderBy('createdAt', 'desc').limit(200).get();
        let bucket = null;
        try { bucket = admin.storage().bucket(); } catch (e) { bucket = null; }
        const items = await Promise.all(q.docs.map(async d => {
          const data = d.data() || {};
          const out = { id: d.id, ...data };
          const toISO = v => {
            if (!v) return null;
            if (typeof v === 'string') return v;
            if (v.toDate && typeof v.toDate === 'function') {
              try { return v.toDate().toISOString(); } catch (e) { }
            }
            if (v.seconds) {
              try { return new Date(Number(v.seconds) * 1000).toISOString(); } catch (e) { }
            }
            try { return new Date(v).toISOString(); } catch (e) { return null; }
          };
          out.createdAt = toISO(data.createdAt) || null;
          out.updatedAt = toISO(data.updatedAt) || null;
          out.approvedAt = toISO(data.approvedAt) || null;
          if (data.storagePath && bucket) {
            try {
              const file = bucket.file(data.storagePath);
              const signed = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
              out.receiptViewUrl = signed && signed[0] ? signed[0] : null;
            } catch (e) {
              out.receiptViewUrl = null;
            }
          } else {
            out.receiptViewUrl = null;
          }
          return out;
        }));
        return res.status(200).json({ ok: true, count: items.length, payments: items });
      }
      if (req.method === 'PATCH' || req.method === 'POST') {
        const id = (req.body && req.body.id) || req.query && req.query.id;
        const action = (req.body && req.body.action) || (req.body && req.body.status);
        const adminNote = req.body && req.body.adminNote ? req.body.adminNote : null;
        if (!id) return res.status(400).json({ ok: false, error: 'id required' });
        if (!action || !['approved', 'rejected'].includes(action)) return res.status(400).json({ ok: false, error: 'invalid action' });
        try {
          const paymentRef = db.collection('payments').doc(id);
          await db.runTransaction(async tx => {
            const pSnap = await tx.get(paymentRef);
            if (!pSnap.exists) throw new Error('payment-not-found');
            const p = pSnap.data();
            if (p.status === 'approved' && action === 'approved') throw new Error('already-approved');
            let uSnap = null;
            const userRef = db.doc(`users/${p.uid}`);
            if (action === 'approved') {
              uSnap = await tx.get(userRef);
              if (!uSnap.exists) {
                tx.set(userRef, { balanceUSDT: Number(p.amount || 0), createdAt: new Date().toISOString() }, { merge: true });
                uSnap = { data: () => ({ balanceUSDT: 0 }) };
              }
            }
            const updates = { status: action, adminNote: adminNote || null, updatedAt: new Date().toISOString() };
            if (action === 'approved') updates.approvedAt = new Date().toISOString();
            tx.set(paymentRef, updates, { merge: true });
            if (action === 'approved') {
              const cur = (uSnap.data && uSnap.data() && uSnap.data().balanceUSDT) || 0;
              const newBal = Number(cur) + Number(p.amount || 0);
              tx.set(userRef, { balanceUSDT: newBal }, { merge: true });
            }
          });
          return res.status(200).json({ ok: true });
        } catch (e) {
          const msg = e && e.message ? e.message : 'internal';
          if (['payment-not-found', 'user-not-found', 'already-approved', 'already-rejected'].includes(msg)) {
            return res.status(400).json({ ok: false, error: msg });
          }
          return res.status(500).json({ ok: false, error: msg });
        }
      }
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'internal' });
    }
  }

  // ========== set-platform-config.js ==========
  if (action === 'set-platform-config') {
    const admin = require('firebase-admin');
    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
      } catch(e) { }
    }
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
      try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch(e) { }
    }
    if (serviceAccount && (!admin.apps || admin.apps.length === 0)) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const db = (admin.apps && admin.apps.length) ? admin.firestore() : null;
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
    const headerSecret = (req.headers['x-admin-secret'] || '').toString();
    const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
    if (!envSecret) {
      return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
    }
    if (!headerSecret || headerSecret !== envSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    let body = req.body;
    let raw = undefined;
    if (!body || typeof body !== 'object' || (typeof body === 'object' && Object.keys(body).length === 0)) {
      raw = req.rawBody;
      if (!raw) {
        try {
          raw = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk.toString(); });
            req.on('end', () => resolve(data));
            req.on('error', err => reject(err));
          });
        } catch (e) { raw = ''; }
      }
      try { body = raw ? JSON.parse(raw) : {}; } catch (e) { body = {}; }
    }
    let lastDebugId = undefined;
    let lastDebugError = undefined;
    const { displayRates, platformDeposit } = body || {};
    if (!displayRates && !platformDeposit) {
      return res.status(400).json({ ok: false, error: 'Nothing to update (expect displayRates or platformDeposit)' });
    }
    try {
      if (!db) return res.status(500).json({ ok: false, error: 'FIREBASE_SERVICE_ACCOUNT env missing or invalid' });
      const docRef = db.doc('platform/platform');
      const nowIso = new Date().toISOString();
      const nowTs = Date.now();
      const payload = { updatedAt: nowIso };
      if (displayRates) payload.displayRates = displayRates;
      if (platformDeposit) {
        try {
          if (typeof platformDeposit === 'object') {
            platformDeposit.updatedAt = nowTs;
          }
        } catch (e) {}
        payload.platformDeposit = platformDeposit;
      }
      let currentVersion = 0;
      try {
        const snap = await docRef.get();
        if (snap && snap.exists) {
          const data = snap.data();
          if (data && typeof data.configVersion === 'number') currentVersion = data.configVersion;
        }
      } catch (e) {}
      payload.configVersion = (currentVersion || 0) + 1;
      await docRef.set(payload, { merge: true });
      try {
        const enableDebug = (process.env.DEBUG_ADMIN_POST || '').toString().toLowerCase() === 'true';
        if (enableDebug && db) {
          const debugDoc = {
            ts: new Date().toISOString(),
            headers: Object.keys(req.headers || {}).reduce((acc, k) => { acc[k] = req.headers[k]; return acc; }, {}),
            contentLength: req.headers && req.headers['content-length'] ? req.headers['content-length'] : null,
            raw: (typeof raw === 'string' && raw.length > 0) ? raw : null,
            parsedBody: (body && Object.keys(body || {}).length) ? body : null,
            platformUpdatedAt: nowIso,
          };
          try {
            const ref = await db.collection('platform_debug_history').add(debugDoc);
            lastDebugId = ref.id;
          } catch (dbgErr) {
            lastDebugError = dbgErr && (dbgErr.stack || dbgErr.message);
          }
        }
      } catch (e) {}
      const resp = { ok: true };
      if (lastDebugId) resp.debugId = lastDebugId;
      if (lastDebugError) resp.debugError = lastDebugError;
      return res.status(200).json(resp);
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'internal error' });
    }
  }

  // ========== users.js ==========
  if (action === 'users') {
    const { getFirestore } = require('../../lib/firestore');
    const method = req.method;
    if (!['GET','PATCH'].includes(method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const headerSecret = (req.headers['x-admin-secret'] || '').toString();
    const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
    if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
    if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
      const id = req.query && (req.query.id || req.query.userId);
      if (id) {
        const doc = await db.collection('users').doc(String(id)).get();
        if (!doc.exists) return res.status(404).json({ ok: false, error: 'user not found' });
        return res.status(200).json({ ok: true, user: { id: doc.id, ...doc.data() } });
      }
      if (method === 'PATCH') {
        try {
          const body = req.body || {};
          const targetId = body.id || body.userId;
          if (!targetId) return res.status(400).json({ ok: false, error: 'id required' });
          const userRef = db.collection('users').doc(String(targetId));
          const doc = await userRef.get();
          if (!doc.exists) return res.status(404).json({ ok: false, error: 'user not found' });
          const dbUpdate = {};
          const respUpdate = {};
          if (body.role) { dbUpdate.role = body.role; respUpdate.role = body.role; }
          if (typeof body.disabled !== 'undefined') { dbUpdate.disabled = !!body.disabled; respUpdate.disabled = !!body.disabled; }
          if (body.resetPassword === true || body.action === 'resetPassword') {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
            let temp = '';
            for (let i=0;i<8;i++) temp += chars[Math.floor(Math.random()*chars.length)];
            const crypto = require('crypto');
            const salt = crypto.randomBytes(16).toString('hex');
            const derivedKey = crypto.scryptSync(temp, salt, 64).toString('hex');
            const storedHash = `${salt}$${derivedKey}`;
            dbUpdate.mustChangePassword = true;
            dbUpdate.tempPasswordHash = storedHash;
            respUpdate.mustChangePassword = true;
            respUpdate.tempPassword = temp;
          }
          await userRef.set(dbUpdate, { merge: true });
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
              if (Object.keys(mongoUpdate.$set).length) {
                await col.updateOne(filter, mongoUpdate, { upsert: false });
              }
              await client.close();
            }
          } catch (e) {}
          return res.status(200).json({ ok: true, id: targetId, update: respUpdate });
        } catch (err) {
          return res.status(500).json({ ok: false, error: 'patch failed' });
        }
      }
      const q = await db.collection('users').orderBy('createdAt', 'desc').limit(200).get();
      const users = [];
      q.forEach(d => users.push({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok: true, count: users.length, users });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'internal' });
    }
  }

  res.status(400).json({ error: 'Unknown action' });
}
