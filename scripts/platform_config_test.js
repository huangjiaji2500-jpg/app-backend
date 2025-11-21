const { getFirestore } = require('../lib/firestore');
(async () => {
  try {
    const fs = getFirestore();
    if (!fs) {
      console.error('FIRESTORE not initialized');
      process.exit(2);
    }
    const docRef = fs.doc('platform/platform');
    const payload = {
      platformDeposit: {
        address: 'TTESTADDRESS123',
        qrImage: 'https://via.placeholder.com/300.png?text=QR',
        note: '测试充值地址',
        updatedAt: Date.now()
      },
      updatedAt: new Date().toISOString(),
      configVersion: Date.now()
    };
    await docRef.set(payload, { merge: true });
    console.log('WROTE platform/platform');
    const snap = await docRef.get();
    console.log('READ BACK', snap.exists ? snap.data() : null);
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
