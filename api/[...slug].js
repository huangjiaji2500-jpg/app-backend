const { getFirestore } = require('../lib/firestore');

module.exports = async (req, res) => {
  // req.query.slug will be an array of path segments after /api/
  const slug = Array.isArray(req.query && req.query.slug) ? req.query.slug : (req.url && req.url.split('?')[0].split('/').slice(2)) || [];

  // Route: POST /api/auth/on-login
  if (slug[0] === 'auth' && slug[1] === 'on-login') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const idToken = (req.body && req.body.idToken) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    const deviceId = req.body && req.body.deviceId;
    if (!idToken) return res.status(400).json({ ok: false, error: 'idToken required' });
    try {
      const db = getFirestore();
      const admin = require('firebase-admin');
      if (!admin || !admin.auth) return res.status(500).json({ ok: false, error: 'firebase-admin not initialized' });
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const profile = {
        uid,
        email: decoded.email || null,
        displayName: decoded.name || decoded.picture || null,
        providers: decoded.firebase && decoded.firebase.sign_in_provider ? [decoded.firebase.sign_in_provider] : null,
        lastLoginAt: new Date().toISOString(),
      };
      if (!db) return res.status(500).json({ ok: false, error: 'firestore unavailable' });
      const userRef = db.doc(`users/${uid}`);
      const snap = await userRef.get();
      if (!snap.exists) profile.createdAt = new Date().toISOString();
      // ensure balance field exists
      if (!snap.exists || snap.data().balanceUSDT === undefined) profile.balanceUSDT = 0;
      // merge profile
      Object.keys(profile).forEach(k => profile[k] === undefined && (profile[k] = null));
      await userRef.set(profile, { merge: true });

      // handle deviceId: append and dedupe
      if (deviceId) {
        try {
          await db.runTransaction(async tx => {
            const uSnap = await tx.get(userRef);
            const cur = (uSnap.exists && uSnap.data().deviceIds) ? uSnap.data().deviceIds : [];
            const set = new Set(Array.isArray(cur) ? cur : []);
            set.add(deviceId);
            const arr = Array.from(set);
            tx.set(userRef, { deviceIds: arr }, { merge: true });
          });
        } catch (e) {
          console.error('[api][auth/on-login] deviceId tx error', e && (e.stack || e.message));
        }
      }

      return res.status(200).json({ ok: true, uid });
    } catch (e) {
      console.error('[api][auth/on-login] error', e && (e.stack || e.message));
      return res.status(500).json({ ok: false, error: 'token verification failed' });
    }
  }

  // Route: GET /api/admin/users
  if (slug[0] === 'admin' && slug[1] === 'users') {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const headerSecret = (req.headers['x-admin-secret'] || '').toString();
    const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
    if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
    if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
      const q = await db.collection('users').orderBy('createdAt', 'desc').limit(200).get();
      const users = [];
      q.forEach(d => users.push({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok: true, count: users.length, users });
    } catch (e) {
      console.error('[api][admin/users] error', e && (e.stack || e.message));
      return res.status(500).json({ ok: false, error: 'internal' });
    }
  }

  // Route: POST /api/payments  (create payment)
  if (slug[0] === 'payments' && (!slug[1] || slug.length === 1)) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const idToken = (req.body && req.body.idToken) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!idToken) return res.status(401).json({ ok: false, error: 'idToken required' });
    try {
      const db = getFirestore();
      const admin = require('firebase-admin');
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const amount = Number(req.body.amount || req.body.value);
      if (!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ ok: false, error: 'invalid amount' });
      const currency = (req.body.currency || 'USDT').toString();
      const note = req.body.note || null;
      let storagePath = null;

      // handle receipt upload: accept receiptBase64 (data URL or raw) or receiptUrl
      const receiptBase64 = req.body.receiptBase64 || req.body.receipt;
      const receiptUrl = req.body.receiptUrl || null;
      if (receiptBase64) {
        // parse data URL
        let base64 = receiptBase64;
        let contentType = 'image/jpeg';
        const m = /^data:(image\/[^;]+);base64,(.+)$/i.exec(base64);
        if (m) {
          contentType = m[1];
          base64 = m[2];
        }
        const buffer = Buffer.from(base64, 'base64');
        const ext = (contentType.split('/')[1] || 'jpg').split('+')[0];
        const ts = Date.now();
        const filename = `payments/${uid}/${ts}.${ext}`;
        try {
          const admin = require('firebase-admin');
          const bucket = admin.storage().bucket();
          const file = bucket.file(filename);
          await file.save(buffer, { metadata: { contentType } });
          storagePath = filename;
        } catch (e) {
          console.error('[api/payments] storage upload error', e && (e.stack || e.message));
        }
      }

      // create payment document
      const payload = {
        uid,
        amount,
        currency,
        note: note || null,
        storagePath: storagePath || null,
        receiptUrl: receiptUrl || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      const ref = await db.collection('payments').add(payload);
      return res.status(200).json({ ok: true, id: ref.id });
    } catch (e) {
      console.error('[api/payments] create error', e && (e.stack || e.message));
      return res.status(500).json({ ok: false, error: 'internal' });
    }
  }

  // Route: GET /api/admin/payments  (admin list)
  if (slug[0] === 'admin' && slug[1] === 'payments') {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const headerSecret = (req.headers['x-admin-secret'] || '').toString();
    const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
    if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
    if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const db = getFirestore();
      const admin = require('firebase-admin');
      if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
      const q = await db.collection('payments').orderBy('createdAt', 'desc').limit(200).get();
      const bucket = admin.storage().bucket();
      const items = await Promise.all(q.docs.map(async d => {
        const data = d.data();
        const out = { id: d.id, ...data };
        if (data.storagePath) {
          try {
            const file = bucket.file(data.storagePath);
            const signed = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
            out.receiptViewUrl = signed && signed[0] ? signed[0] : null;
          } catch (e) {
            out.receiptViewUrl = null;
          }
        }
        return out;
      }));
      return res.status(200).json({ ok: true, count: items.length, payments: items });
    } catch (e) {
      console.error('[api][admin/payments] error', e && (e.stack || e.message));
      return res.status(500).json({ ok: false, error: 'internal' });
    }
  }

  // Route: PATCH /api/admin/payments/:id  (approve/reject)
  if (slug[0] === 'admin' && slug[1] === 'payments' && slug[2]) {
    if (req.method !== 'PATCH' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const headerSecret = (req.headers['x-admin-secret'] || '').toString();
    const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
    if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
    if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const paymentId = slug[2];
    const action = (req.body && req.body.action) ? req.body.action.toString() : (req.body && req.body.status) ? req.body.status.toString() : null; // 'approved'|'rejected'
    const adminNote = req.body && req.body.adminNote ? req.body.adminNote : null;
    if (!action || !['approved', 'rejected'].includes(action)) return res.status(400).json({ ok: false, error: 'invalid action' });
    try {
      const db = getFirestore();
      const admin = require('firebase-admin');
      const paymentRef = db.collection('payments').doc(paymentId);
      await db.runTransaction(async tx => {
        const pSnap = await tx.get(paymentRef);
        if (!pSnap.exists) throw new Error('payment-not-found');
        const p = pSnap.data();
        if (p.status === 'approved' && action === 'approved') throw new Error('already-approved');
        // update payment
        const updates = { status: action, adminNote: adminNote || null, updatedAt: new Date().toISOString() };
        if (action === 'approved') updates.approvedAt = new Date().toISOString();
        tx.set(paymentRef, updates, { merge: true });
        // if approved, increment user's balance
        if (action === 'approved') {
          const userRef = db.doc(`users/${p.uid}`);
          const uSnap = await tx.get(userRef);
          if (!uSnap.exists) throw new Error('user-not-found');
          const cur = uSnap.data().balanceUSDT || 0;
          const newBal = Number(cur) + Number(p.amount || 0);
          tx.set(userRef, { balanceUSDT: newBal }, { merge: true });
        }
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[api][admin/payments:update] error', e && (e.stack || e.message));
      return res.status(500).json({ ok: false, error: e && e.message ? e.message : 'internal' });
    }
  }

  return res.status(404).json({ ok: false, error: 'not-found' });
};
