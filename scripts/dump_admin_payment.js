const https = require('https');
const url = 'https://app-9ppb7ic5c-linlins-projects-0f242d73.vercel.app/api/admin/payments';
const secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6';
const targetId = process.argv[2];
if(!targetId){ console.error('Usage: node dump_admin_payment.js <docId>'); process.exit(2); }

function request(url, headers){
  return new Promise((resolve,reject)=>{
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port || 443, path: u.pathname + (u.search||''), method: 'GET', headers };
    const req = https.request(opts, res=>{
      let d=''; res.on('data', c=> d+=c); res.on('end', ()=> resolve({status:res.statusCode, body:d}));
    });
    req.on('error', reject);
    req.end();
  });
}

(async ()=>{
  try{
    const r = await request(url, { 'x-admin-secret': secret });
    if(r.status !== 200) return console.error('status', r.status, r.body);
    const j = JSON.parse(r.body);
    const payments = j.payments || [];
    const found = payments.find(p => p._id === targetId || p.id === targetId || (p.payload && p.payload.item && p.payload.item.id === targetId));
    if(!found) return console.error('not found, total payments=', payments.length);
    console.log(JSON.stringify(found, null, 2));
  }catch(e){ console.error(e && e.message || e); }
})();
