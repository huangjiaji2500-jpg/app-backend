const getFirestore = require('../lib/firestore').getFirestore;
let db = getFirestore();
if (!db) {
  // fallback to local serviceAccountKey.json if present (many repo scripts use this)
  try {
    const admin = require('firebase-admin');
    const path = require('path');
    const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
    const serviceAccount = require(keyPath);
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    db = admin.firestore();
  } catch (e) {
    console.error('Failed to initialize Firestore. Ensure FIREBASE_SERVICE_ACCOUNT env var is set or serviceAccountKey.json is present.');
    console.error(e && e.message);
    process.exit(1);
  }
}

async function scan() {
  const out = [];
  const col = db.collection('sync_items');
  console.log('Starting dry-run scan of sync_items... this is read-only');

  // Stream all documents but process in pages to avoid memory spikes
  const snapshot = await col.get();
  console.log(`Fetched ${snapshot.size} sync_items documents`);

  snapshot.forEach(doc => {
    const data = doc.data();
    const payload = data.payload || {};
    const item = payload.item || {};
    const nested = item.item || {};

    const requested = (nested && (nested.amountRequestedUSDT || nested.amountRequested)) || (item && (item.amountRequestedUSDT || item.amountRequested)) || null;
    const approvedTop = item && (item.amountApprovedUSDT || item.amountApproved);
    const approvedNested = nested && (nested.amountApprovedUSDT || nested.amountApproved);

    if (requested && !(approvedTop || approvedNested)) {
      // determine username from nested or item or top-level username fields
      const username = nested.username || item.username || data.username || (payload && payload.username) || null;
      out.push({ id: doc.id, username: username || null, amountRequestedUSDT: requested });
    }
  });

  // Print as JSON array (compact)
  console.log(JSON.stringify(out, null, 2));
  console.log(`Dry-run complete. Found ${out.length} candidate(s).`);
}

scan().catch(err => {
  console.error('Scan failed:', err);
  process.exit(2);
});
