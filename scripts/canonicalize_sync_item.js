const admin = require('firebase-admin');
const path = require('path');

async function main(){
  const args = process.argv.slice(2);
  if(args.length < 2){
    console.error('usage: node canonicalize_sync_item.js <docId> <amount>');
    process.exit(2);
  }
  const [docId, amountRaw] = args;
  const amount = Number(amountRaw);
  if(Number.isNaN(amount)){
    console.error('amount must be a number');
    process.exit(2);
  }

  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const ref = db.collection('sync_items').doc(docId);
  const snap = await ref.get();
  if(!snap.exists){
    console.error('doc not found:', docId);
    process.exit(3);
  }
  const data = snap.data() || {};
  const payload = data.payload || {};

  // Build minimal updates to normalize common shapes without touching balances
  const updates = {};

  // top-level canonical payload.amount
  updates['payload.amount'] = amount;

  // If payload.item exists, set payload.item.amount (and amountRequestedUSDT if missing)
  if(payload.item){
    updates['payload.item.amount'] = amount;
    if(!('amountRequestedUSDT' in payload.item)) updates['payload.item.amountRequestedUSDT'] = amount;
  }

  // If payload.deposit.item exists, set nested fields there
  if(payload.deposit && payload.deposit.item){
    updates['payload.deposit.item.amount'] = amount;
    if(!('amountRequestedUSDT' in payload.deposit.item)) updates['payload.deposit.item.amountRequestedUSDT'] = amount;
  }

  // If payload.deposit exists but not deposit.item, try to set payload.deposit.amount
  if(payload.deposit && !payload.deposit.item){
    updates['payload.deposit.amount'] = amount;
    if(!('amountRequestedUSDT' in payload.deposit)) updates['payload.deposit.amountRequestedUSDT'] = amount;
  }

  // Also support double-nested item.item (some records had item.item)
  if(payload.item && payload.item.item){
    updates['payload.item.item.amount'] = amount;
    if(!('amountRequestedUSDT' in payload.item.item)) updates['payload.item.item.amountRequestedUSDT'] = amount;
  }

  // Add an updatedAt timestamp for traceability
  updates['updatedAt'] = new Date().toISOString();

  console.log('Applying updates to', docId, '=>', updates);
  await ref.update(updates);

  const after = await ref.get();
  console.log('After snapshot:', JSON.stringify({ id: docId, payload: (after.data()||{}).payload }, null, 2));
  console.log('Done. (did not change any user balances)');
  process.exit(0);
}

main().catch(err=>{ console.error(err && err.stack || err); process.exit(2); });
