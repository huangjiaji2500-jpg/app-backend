const { getFirestore } = require('../lib/firestore');

module.exports = async (req, res) => {
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

    const receiptBase64 = req.body.receiptBase64 || req.body.receipt;
    const receiptUrl = req.body.receiptUrl || null;
    if (receiptBase64) {
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
        try {
          const bucket = require('firebase-admin').storage().bucket();
          const file = bucket.file(filename);
          await file.save(buffer, { metadata: { contentType } });
          storagePath = filename;
        } catch (e) {
          console.error('[api/payments] storage upload error (inner)', e && (e.stack || e.message));
        }
      } catch (e) {
        console.error('[api/payments] storage upload error', e && (e.stack || e.message));
      }
    }

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
};
