const fs = require('fs');
const admin = require('firebase-admin');
const env = fs.readFileSync('.vercel.env','utf8');
const m = env.match(/FIREBASE_SERVICE_ACCOUNT_BASE64=(?:"([\s\S]*?)"|(.+))/m);
if(!m){ console.log('no FIREBASE_SERVICE_ACCOUNT_BASE64'); process.exit(0); }
const b = m[1] || m[2] || '';
const decoded = Buffer.from(b,'base64').toString('utf8');
const j = JSON.parse(decoded);
console.log('parsed keys:', Object.keys(j));
try{
  const cred = admin.credential.cert(j);
  console.log('credential created ok');
} catch(e){
  console.error('credential creation error:', e && (e.stack||e));
}
