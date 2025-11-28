const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  if(!fs.existsSync(keyPath)){ console.error('serviceAccountKey.json not found in project root'); process.exit(2); }
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const outDir = path.resolve(__dirname, '..', 'audit');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  console.log('Scanning sync_items...');
  const snapshot = await db.collection('sync_items').get();
  console.log('Found', snapshot.size, 'documents');

  let count = 0;
  for(const doc of snapshot.docs){
    const id = doc.id;
    const data = doc.data() || {};
    const payload = data.payload || {};

    // determine if canonicalization needed
    const needs = [];
    if(typeof payload.amount === 'undefined') needs.push('payload.amount');
    if(payload.item){
      if(typeof payload.item.amount === 'undefined') needs.push('payload.item.amount');
      if(typeof payload.item.amountRequestedUSDT === 'undefined') needs.push('payload.item.amountRequestedUSDT');
    }
    if(payload.deposit && payload.deposit.item){
      if(typeof payload.deposit.item.amount === 'undefined') needs.push('payload.deposit.item.amount');
      if(typeof payload.deposit.item.amountRequestedUSDT === 'undefined') needs.push('payload.deposit.item.amountRequestedUSDT');
    }
    if(payload.item && payload.item.item){
      if(typeof payload.item.item.amount === 'undefined') needs.push('payload.item.item.amount');
      if(typeof payload.item.item.amountRequestedUSDT === 'undefined') needs.push('payload.item.item.amountRequestedUSDT');
    }

    if(needs.length === 0) continue; // skip

    // write pre-audit
    fs.writeFileSync(path.join(outDir, `${id}.canonicalize.pre.json`), JSON.stringify({ id, data }, null, 2));

    // choose an amount from existing fields or fallback 0
    const amount = (payload.amount || (payload.item && payload.item.amount) || (payload.deposit && payload.deposit.item && payload.deposit.item.amount) || (payload.item && payload.item.item && payload.item.item.amount) || 0);

    const updates = {};
    updates['payload.amount'] = amount;
    if(payload.item){ updates['payload.item.amount'] = amount; if(!('amountRequestedUSDT' in payload.item)) updates['payload.item.amountRequestedUSDT'] = amount; }
    if(payload.deposit && payload.deposit.item){ updates['payload.deposit.item.amount'] = amount; if(!('amountRequestedUSDT' in payload.deposit.item)) updates['payload.deposit.item.amountRequestedUSDT'] = amount; }
    if(payload.item && payload.item.item){ updates['payload.item.item.amount'] = amount; if(!('amountRequestedUSDT' in payload.item.item)) updates['payload.item.item.amountRequestedUSDT'] = amount; }
    updates['updatedAt'] = new Date().toISOString();

    try{
      await db.collection('sync_items').doc(id).update(updates);
      const after = await db.collection('sync_items').doc(id).get();
      fs.writeFileSync(path.join(outDir, `${id}.canonicalize.post.json`), JSON.stringify({ id, data: after.data() || {} }, null, 2));
      console.log('Canonicalized', id, 'updated keys:', Object.keys(updates));
      count++;
    }catch(e){
      console.error('Failed to update', id, e && e.message);
    }
  }

  console.log('Done. total canonicalized:', count);
  process.exit(0);
}

main().catch(err=>{ console.error(err && err.stack || err); process.exit(2); });
