const https = require('https');
const admin = require('firebase-admin');
const path = require('path');

function fetchQrPng(address, size=600){
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(address)}`;
  return new Promise((resolve, reject)=>{
    https.get(url, (res)=>{
      if(res.statusCode !== 200){
        return reject(new Error('QR fetch status '+res.statusCode));
      }
      const chunks = [];
      res.on('data', c=>chunks.push(c));
      res.on('end', ()=>{
        const buf = Buffer.concat(chunks);
        resolve(buf);
      });
    }).on('error', reject);
  });
}

async function main(){
  const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const address = process.argv[2] || 'TYfGGw8W2YPX3edLwQL5sMBBA57TuntQwu';
  console.log('Generating QR for:', address);
  const png = await fetchQrPng(address, 600);
  const b64 = png.toString('base64');
  const dataUrl = 'data:image/png;base64,' + b64;

  const now = Date.now();
  const platformDeposit = {
    address,
    qrImage: dataUrl,
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
  console.log('Wrote sync_items doc id:', ref.id);

  // optional: also write to platform/platform doc so backend fallback also sees it
  try{
    await db.doc('platform/platform').set({ platformDeposit }, { merge: true });
    console.log('Also updated platform/platform document');
  }catch(e){ console.warn('Failed to update platform/platform doc:', e.message||e);
  }

  process.exit(0);
}

main().catch(e=>{ console.error('ERROR', e && (e.stack||e.message)); process.exit(2); });
