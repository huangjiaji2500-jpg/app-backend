const admin = require('firebase-admin');
const path = require('path');

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const docId = process.argv[2];
  const username = process.argv[3];
  const amount = Number(process.argv[4] || '0');
  if(!docId || !username || !amount){ console.error('usage: node fix_deposit_and_increment.js <docId> <username> <amount>'); process.exit(2); }

  const docRef = db.collection('sync_items').doc(docId);
  const usersRef = db.collection('users');
  const userBalancesRef = db.collection('user_balances');

  // Read pre-snapshot
  const preSnap = await docRef.get();
  if(!preSnap.exists){ console.error('sync_items doc not found'); process.exit(3); }
  const preData = preSnap.data();

  // Try to find user doc id
  const uq = await usersRef.where('username','==',username).limit(1).get();
  let userDocId = null;
  let preUserData = null;
  if(!uq.empty){ userDocId = uq.docs[0].id; preUserData = uq.docs[0].data(); }
  else {
    const ub = await userBalancesRef.doc(username).get();
    if(ub.exists){ userDocId = `user_balances/${username}`; preUserData = ub.data(); }
  }

  const timestamp = new Date().toISOString();
  console.log('=== PRE-SNAPSHOT ===');
  console.log('time:', timestamp);
  console.log('sync_items doc id:', docId);
  console.log(JSON.stringify(preData, null, 2));
  console.log('user doc id:', userDocId || '(not found)');
  console.log(JSON.stringify(preUserData || {}, null, 2));

  // Perform transactional update: write back approved amount into nested locations and increment user topupBalance
  try{
    await db.runTransaction(async (t) => {
      const d = await t.get(docRef);
      if(!d.exists) throw new Error('sync_items doc disappeared');
      const data = d.data() || {};
      const payload = data.payload || data.data || {};
      payload.item = payload.item || {};
      payload.item.item = payload.item.item || {};

      // set approved amount in both payload.item and payload.item.item
      if(!payload.item.amountApprovedUSDT || Number(payload.item.amountApprovedUSDT) === 0){ payload.item.amountApprovedUSDT = amount; }
      payload.item.item.amountApprovedUSDT = amount;
      // also ensure amount fields exist for consistency
      if(!payload.item.amount) payload.item.amount = amount;
      if(!payload.item.item.amount) payload.item.item.amount = amount;
      // ensure statuses
      payload.item.status = 'approved';
      payload.item.item.status = 'approved';

      const updateObj = { payload, updatedAt: timestamp };
      t.update(docRef, updateObj);

      // find and increment user topupBalance
      const q = await usersRef.where('username','==',username).limit(1).get();
      if(!q.empty){ const udoc = q.docs[0]; const uref = usersRef.doc(udoc.id); t.update(uref, { topupBalance: FieldValue.increment(amount), updatedAt: timestamp }); }
      else {
        // set/merge into user_balances doc
        const ubRef = userBalancesRef.doc(username);
        t.set(ubRef, { username, topupBalance: FieldValue.increment ? FieldValue.increment(amount) : amount, updatedAt: timestamp }, { merge: true });
      }
    });
  }catch(e){ console.error('transaction failed', e && e.stack || e); process.exit(4); }

  // Read post-snapshot
  const postSnap = await docRef.get();
  const postData = postSnap.exists ? postSnap.data() : null;
  let postUserData = null;
  if(userDocId && userDocId.startsWith('user_balances/')){
    const ub = await userBalancesRef.doc(username).get(); if(ub.exists) postUserData = ub.data();
  } else if(userDocId){ const u = await usersRef.doc(userDocId).get(); if(u.exists) postUserData = u.data(); }
  else {
    const q2 = await usersRef.where('username','==',username).limit(1).get(); if(!q2.empty){ postUserData = q2.docs[0].data(); userDocId = q2.docs[0].id; }
    else { const ub2 = await userBalancesRef.doc(username).get(); if(ub2.exists) { postUserData = ub2.data(); userDocId = `user_balances/${username}`; } }
  }

  const doneAt = new Date().toISOString();
  console.log('\n=== POST-SNAPSHOT ===');
  console.log('time:', doneAt);
  console.log('sync_items doc id:', docId);
  console.log(JSON.stringify(postData, null, 2));
  console.log('user doc id:', userDocId || '(not found)');
  console.log(JSON.stringify(postUserData || {}, null, 2));

  console.log('\nOperation complete.');
  process.exit(0);
}

main().catch(err=>{ console.error(err && err.stack || err); process.exit(2); });
