const admin = require('firebase-admin');
const path = require('path');

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const username = process.env.CUSTOM_USERNAME || process.env.USERNAME || 'testuser_local';
  const amount = Number(process.env.AMOUNT || '5');
  const now = Date.now();

  const payload = { action: 'test', ts: now, item: { username, amountApprovedUSDT: amount, status: 'pending' } };
  const doc = {
    type: 'deposit',
    data: payload,
    payload: payload,
    ts: now,
    receivedAt: now
  };

  const ref = await db.collection('sync_items').add(doc);
  console.log('createdId:', ref.id);
  process.exit(0);
}

main().catch(err=>{ console.error('error:', err && err.stack || err); process.exit(2); });
