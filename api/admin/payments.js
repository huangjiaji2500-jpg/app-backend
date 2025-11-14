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
          const updates = { status: action, adminNote: adminNote || null, updatedAt: new Date().toISOString() };
          if (action === 'approved') updates.approvedAt = new Date().toISOString();
          tx.set(paymentRef, updates, { merge: true });
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
        console.error('[api/admin/payments:update] error', e && (e.stack || e.message));
        return res.status(500).json({ ok: false, error: e && e.message ? e.message : 'internal' });
      }
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    console.error('[api/admin/payments] error', e && (e.stack || e.message));
    return res.status(500).json({ ok: false, error: 'internal' });
  }
};
