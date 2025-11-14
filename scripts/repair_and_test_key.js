const fs = require('fs');
const admin = require('firebase-admin');
const env = fs.readFileSync('.vercel.env','utf8');
const m = env.match(/FIREBASE_SERVICE_ACCOUNT_BASE64=(?:"([\s\S]*?)"|(.+))/m);
if(!m){ console.log('no FIREBASE_SERVICE_ACCOUNT_BASE64'); process.exit(0); }
const b = m[1] || m[2] || '';
const decoded = Buffer.from(b,'base64').toString('utf8');
let j;
try{ j = JSON.parse(decoded); } catch(e){ console.error('JSON parse error', e); process.exit(1); }
console.log('original private_key length', j.private_key && j.private_key.length);
// Attempt 1: normalize CRLF -> LF and trim
let pk = j.private_key.replace(/\r\n/g, '\n').trim() + '\n';
console.log('normalized private_key length', pk.length);
// Extract base64 body
const inner = pk.replace(/-----BEGIN PRIVATE KEY-----/,'').replace(/-----END PRIVATE KEY-----/,'').replace(/\n/g,'').replace(/\r/g,'').trim();
console.log('inner base64 length', inner.length);
try{
  const buf = Buffer.from(inner,'base64');
  console.log('decoded inner buffer length', buf.length);
} catch(e){ console.error('base64 decode failed', e && e.message); }
// Try creating credential with normalized key
j.private_key = pk;
try{
  const cred = admin.credential.cert(j);
  console.log('credential created OK after normalization');
} catch(e){
  console.error('credential creation still fails:', e && (e.stack || e.message));
  // Try an alternate normalization: ensure lines are 64-char wrapped
  const body = inner;
  const wrapped = body.match(/.{1,64}/g).join('\n');
  const pk2 = '-----BEGIN PRIVATE KEY-----\n' + wrapped + '\n-----END PRIVATE KEY-----\n';
  j.private_key = pk2;
  console.log('attempting with wrapped key, length', pk2.length);
  try{
    const cred2 = admin.credential.cert(j);
    console.log('credential created OK after wrapping');
  } catch(e2){ console.error('still failing after wrapping:', e2 && (e2.stack||e2.message)); }
}
