const fs = require('fs');
const env = fs.readFileSync('.vercel.env','utf8');
const m = env.match(/FIREBASE_SERVICE_ACCOUNT_BASE64=(?:"([\s\S]*?)"|(.+))/m);
if(!m){ console.log('no FIREBASE_SERVICE_ACCOUNT_BASE64 found'); process.exit(0); }
const b = m[1] || m[2] || '';
const decoded = Buffer.from(b,'base64').toString('utf8');
console.log('decoded length', decoded.length);
try{
  const j = JSON.parse(decoded);
  console.log('has private_key?', !!j.private_key);
  if(j.private_key){
    console.log('private_key length', j.private_key.length);
    console.log('private_key contains literal \\n?', j.private_key.includes('\\n'));
    console.log('private_key contains actual newline?', j.private_key.includes('\n'));
    console.log('private_key prefix:', j.private_key.slice(0,80));
    console.log('private_key suffix:', j.private_key.slice(-80));
  }
} catch(e){
  console.error('JSON parse error', e && (e.stack || e.message));
  console.log('decoded preview:\n', decoded.slice(0,1000));
}
