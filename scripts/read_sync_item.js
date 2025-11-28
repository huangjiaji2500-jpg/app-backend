const admin = require('firebase-admin');
const path = require('path');

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const docId = process.argv[2];
  if(!docId){ console.error('usage: node read_sync_item.js <docId>'); process.exit(2); }

  const ref = db.collection('sync_items').doc(docId);
  const snap = await ref.get();
  if(!snap.exists){ console.error('doc not found'); process.exit(3); }
  const data = snap.data() || {};
  const payload = data.payload || data.data || {};
  // 支持多种形态：payload.item、payload.deposit.item、或直接在 payload.deposit
  payload.item = payload.item || (payload.deposit && payload.deposit.item) || payload.deposit || {};

  // Print concise JSON with relevant fields
  const item = payload.item || {};
  const nested = item.item || {};
  const out = {
    id: docId,
    username_top: data.username || null,
    username_item: item.username || null,
    username_nested: nested.username || null,
    status_top: data.status || data.state || null,
    updatedAt: data.updatedAt || null,
    payload_status: item.status || null,
    amountRequestedUSDT: nested.amountRequestedUSDT || nested.amountRequested || nested.amount || item.amountRequestedUSDT || item.amountRequested || item.amount || null,
    amountApprovedUSDT: (Object.prototype.hasOwnProperty.call(nested,'amountApprovedUSDT') ? nested.amountApprovedUSDT : (Object.prototype.hasOwnProperty.call(item,'amountApprovedUSDT') ? item.amountApprovedUSDT : null)),
    reviewerUsername: nested.reviewerUsername || nested.reviewer || item.reviewerUsername || item.reviewer || null,
    item_keys: Object.keys(item).slice(0,50),
    nested_keys: Object.keys(nested).slice(0,80),
    payload_amount: payload.amount || null,
    proofImage_present: !!(item.proofImage || item.proofImageUrl || (item.images && item.images[0]) || (item.attachments && item.attachments[0]))
  };

  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

main().catch(err=>{ console.error(err && err.stack || err); process.exit(2); });
