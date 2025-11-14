const fs = require('fs');
const crypto = require('crypto');
const env = fs.readFileSync('.vercel.env','utf8');
const m = env.match(/FIREBASE_SERVICE_ACCOUNT_BASE64=(?:"([\s\S]*?)"|(.+))/m);
if(!m){ console.log('no FIREBASE_SERVICE_ACCOUNT_BASE64'); process.exit(0); }
const b = m[1] || m[2] || '';
const decoded = Buffer.from(b,'base64').toString('utf8');
const j = JSON.parse(decoded);
let pk = j.private_key.replace(/\r\n/g,'\n').trim() + '\n';
console.log('attempting crypto import...');
try{
  const k = crypto.createPrivateKey({key: pk, format: 'pem'});
  console.log('crypto parsed key ok, type:', k.type, 'asymmetricKeyType:', k.asymmetricKeyType);
} catch(e){ console.error('crypto parse error:', e && (e.stack || e.message)); }
