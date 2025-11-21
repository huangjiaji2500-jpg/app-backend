const admin = require('firebase-admin');
const path = require('path');

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const docId = process.argv[2];
  const amount = Number(process.argv[3] || '1');
  if(!docId){ console.error('usage: node update_deposit_set_amount.js <docId> [amount]'); process.exit(2); }

  const ref = db.collection('sync_items').doc(docId);
  const snap = await ref.get();
  if(!snap.exists){ console.error('doc not found'); process.exit(3); }
  const data = snap.data() || {};
  const payload = data.payload || data.data || {};
  payload.item = payload.item || {};
  payload.item.amountApprovedUSDT = amount;
  payload.item.amount = amount;
  await ref.update({ payload, updatedAt: new Date().toISOString() });
  console.log('updated', docId);
  process.exit(0);
}

main().catch(err=>{ console.error(err && err.stack || err); process.exit(2); });
