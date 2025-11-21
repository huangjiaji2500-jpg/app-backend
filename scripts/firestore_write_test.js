const { getFirestore } = require('../lib/firestore');
(async () => {
  try {
    const fs = getFirestore();
    if (!fs) {
      console.error('FIRESTORE not initialized: check FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT in env');
      process.exit(2);
    }
    const docRef = fs.collection('users').doc('local_test_user_' + Date.now());
    const payload = { test: true, ts: new Date().toISOString(), note: 'local firestore write test' };
    await docRef.set(payload, { merge: true });
    console.log('WROTE', docRef.path);
    const snap = await docRef.get();
    console.log('READ BACK', snap.exists ? snap.data() : null);
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
