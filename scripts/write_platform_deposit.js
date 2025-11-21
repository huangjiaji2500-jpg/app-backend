const admin = require('firebase-admin');
const path = require('path');

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const now = Date.now();
  const platformDeposit = {
    address: 'TYfGGw8W2YPX3edLwQL5sMBBA57TuntQwu',
    qrImage: '',
    note: '仅接收 USDT(TRC20)',
    updatedAt: now
  };

  const doc = {
    type: 'platform-deposit',
    data: platformDeposit,
    payload: { platformDeposit, ts: now },
    ts: now,
    receivedAt: now
  };

  const ref = await db.collection('sync_items').add(doc);
  console.log('createdId:', ref.id);
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(2); });
