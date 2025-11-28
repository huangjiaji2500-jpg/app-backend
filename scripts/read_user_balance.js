const admin = require('firebase-admin');
const path = require('path');

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const username = process.argv[2];
  if(!username){ console.error('usage: node read_user_balance.js <username>'); process.exit(2); }

  // Try common locations
  const tries = [];
  // direct users/<username>
  tries.push(async ()=>{
    const ref = db.collection('users').doc(username);
    const snap = await ref.get();
    if(snap.exists) return {path:`users/${username}`, data:snap.data()};
    return null;
  });
  // query users where username == value
  tries.push(async ()=>{
    const q = await db.collection('users').where('username','==',username).limit(1).get();
    if(!q.empty) return {path:`users (query)`, data:q.docs[0].data()};
    return null;
  });
  // user_balances/<username>
  tries.push(async ()=>{
    const ref = db.collection('user_balances').doc(username);
    const snap = await ref.get();
    if(snap.exists) return {path:`user_balances/${username}`, data:snap.data()};
    return null;
  });
  // query user_balances where username == value
  tries.push(async ()=>{
    const q = await db.collection('user_balances').where('username','==',username).limit(1).get();
    if(!q.empty) return {path:'user_balances (query)', data:q.docs[0].data()};
    return null;
  });

  for(const fn of tries){
    try{
      const res = await fn();
      if(res){
        console.log('found at', res.path);
        console.log(JSON.stringify(res.data, null, 2));
        return process.exit(0);
      }
    }catch(e){ /* continue */ }
  }

  console.error('user not found in tried collections');
  process.exit(3);
}

main().catch(err=>{ console.error(err && err.stack || err); process.exit(2); });
