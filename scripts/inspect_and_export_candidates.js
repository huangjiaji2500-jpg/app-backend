const fs = require('fs');
const path = require('path');
const getFirestore = require('../lib/firestore').getFirestore;

const db = getFirestore() || (function(){
  try {
    const admin = require('firebase-admin');
    const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      const serviceAccount = require(keyPath);
      if (!admin.apps || admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      return admin.firestore();
    }
  } catch(e){}
  console.error('Failed to initialize Firestore. Set FIREBASE_SERVICE_ACCOUNT env or have serviceAccountKey.json');
  process.exit(1);
})();

async function inspect() {
  const col = db.collection('sync_items');
  console.log('Fetching all sync_items (read-only)...');
  const snapshot = await col.get();
  console.log(`Total documents: ${snapshot.size}`);

  const results = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const payload = data.payload || {};
    const item = payload.item || {};
    const nested = item.item || {};

    const requested = (nested && (nested.amountRequestedUSDT || nested.amountRequested)) || (item && (item.amountRequestedUSDT || item.amountRequested)) || null;
    const approvedTop = item && (item.amountApprovedUSDT || item.amountApproved);
    const approvedNested = nested && (nested.amountApprovedUSDT || nested.amountApproved);

    if (requested && !(approvedTop || approvedNested)) {
      const username = nested.username || item.username || data.username || (payload && payload.username) || null;
      const proof = (nested && (nested.proofImage || nested.receipt || nested.attachments)) || (item && (item.proofImage || item.receipt || item.attachments)) || null;
      const hasProof = !!proof;
      const reviewer = (nested && nested.reviewerUsername) || (item && item.reviewerUsername) || data.reviewerUsername || null;
      const createdAt = (nested && nested.createdAt) || (item && item.createdAt) || data.createdAt || null;
      const reviewedAt = (nested && nested.reviewedAt) || (item && item.reviewedAt) || data.reviewedAt || null;

      results.push({
        id: doc.id,
        username: username || null,
        amountRequestedUSDT: requested,
        hasProof: hasProof,
        reviewerUsername: reviewer || null,
        createdAt: createdAt || null,
        reviewedAt: reviewedAt || null
      });
    }
  });

  // Ensure exports dir
  const exportsDir = path.resolve(__dirname, '..', 'exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);

  const jsonPath = path.join(exportsDir, 'unapproved_candidates.json');
  const csvPath = path.join(exportsDir, 'unapproved_candidates.csv');

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

  // build CSV header
  const header = ['id','username','amountRequestedUSDT','hasProof','reviewerUsername','createdAt','reviewedAt'];
  const csvLines = [header.join(',')];
  results.forEach(r => {
    const line = [
      r.id,
      r.username ? (`"${String(r.username).replace(/"/g,'""')}"`) : '',
      r.amountRequestedUSDT,
      r.hasProof,
      r.reviewerUsername ? (`"${String(r.reviewerUsername).replace(/"/g,'""')}"`) : '',
      r.createdAt || '',
      r.reviewedAt || ''
    ];
    csvLines.push(line.join(','));
  });
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');

  console.log(`Inspect complete. Found ${results.length} candidate(s).`);
  console.log(`Exported JSON: ${jsonPath}`);
  console.log(`Exported CSV:  ${csvPath}`);
  console.log(JSON.stringify(results, null, 2));
}

inspect().catch(err => {
  console.error('Inspect failed:', err && err.message);
  process.exit(2);
});
