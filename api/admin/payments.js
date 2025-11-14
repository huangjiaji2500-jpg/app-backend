const { getFirestore } = require('../../lib/firestore');

module.exports = async (req, res) => {
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
        // normalize Firestore Timestamps to ISO strings for frontend
        const toISO = v => {
          if (!v) return null;
          if (typeof v === 'string') return v;
          if (v.toDate && typeof v.toDate === 'function') {
            try { return v.toDate().toISOString(); } catch (e) { /* fallthrough */ }
          }
          if (v.seconds) {
            try { return new Date(Number(v.seconds) * 1000).toISOString(); } catch (e) { /* fallthrough */ }
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
          // Read payment first
          const pSnap = await tx.get(paymentRef);
          if (!pSnap.exists) throw new Error('payment-not-found');
          const p = pSnap.data();
          if (p.status === 'approved' && action === 'approved') throw new Error('already-approved');

          // If we need to update user balance (approve), read the user BEFORE any writes
          let uSnap = null;
          const userRef = db.doc(`users/${p.uid}`);
          if (action === 'approved') {
            uSnap = await tx.get(userRef);
            // If user does not exist, create a minimal user doc instead of failing
            // This allows admins to approve payments for users that haven't been upserted via login.
            if (!uSnap.exists) {
              // create initial user doc with balance equal to the approved amount
              tx.set(userRef, { balanceUSDT: Number(p.amount || 0), createdAt: new Date().toISOString() }, { merge: true });
              // set uSnap to a fake snapshot-like object for later balance calculation
              uSnap = { data: () => ({ balanceUSDT: 0 }) };
            }
          }

          // Prepare updates and perform writes only after all reads
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
        console.error('[api/admin/payments:update] error', e && (e.stack || e.message));
        const msg = e && e.message ? e.message : 'internal';
        // Known client errors -> 400, others -> 500
        if (['payment-not-found', 'user-not-found', 'already-approved', 'already-rejected'].includes(msg)) {
          return res.status(400).json({ ok: false, error: msg });
        }
        return res.status(500).json({ ok: false, error: msg });
      }
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    console.error('[api/admin/payments] error', e && (e.stack || e.message));
    return res.status(500).json({ ok: false, error: 'internal' });
  }
};
