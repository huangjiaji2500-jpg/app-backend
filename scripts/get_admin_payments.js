const https = require('https');

const url = 'https://app-9ppb7ic5c-linlins-projects-0f242d73.vercel.app/api/admin/payments';
const secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6';

const opts = new URL(url);
opts.method = 'GET';
opts.headers = { 'x-admin-secret': secret };

const req = https.request(opts, (res)=>{
  let d = '';
  res.on('data', c => d += c);
  res.on('end', ()=>{
    console.log('STATUS', res.statusCode);
    try{ console.log(JSON.stringify(JSON.parse(d), null, 2)); }catch(e){ console.log(d); }
  });
});
req.on('error', e => console.error('ERR', e && e.message));
req.end();
