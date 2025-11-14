const fs=require('fs');
const env=fs.readFileSync('.vercel.env','utf8');
const re=/FIREBASE_SERVICE_ACCOUNT_BASE64=(?:"([\s\S]*?)"|(.+))/m;
const m=env.match(re);
if(!m){ console.error('no match'); process.exit(1); }
const b=m[1]||m[2]||'';
const decoded=Buffer.from(b,'base64').toString('utf8');
const j=JSON.parse(decoded);
const inner=j.private_key.replace(/-----.*PRIVATE KEY-----/g,'').replace(/\r|\n/g,'');
const buf=Buffer.from(inner,'base64');
console.log('buf len', buf.length);
console.log('head hex', buf.slice(0,32).toString('hex'));
console.log('tail hex', buf.slice(-32).toString('hex'));
