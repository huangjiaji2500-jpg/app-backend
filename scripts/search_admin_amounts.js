const https = require('https');
const url = 'https://app-9ppb7ic5c-linlins-projects-0f242d73.vercel.app/api/admin/payments';
const secret = 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6';

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
    const body = r.body;
    const keys = ['amountRequestedUSDT','amountRequested','amountApprovedUSDT','amountApproved','amountUSDT','amount'];
    for(const k of keys){
      const re = new RegExp('"'+k+'"\s*:\s*([^,\n\r]+)', 'gi');
      let m; let found=0;
      while((m=re.exec(body))!==null){
        found++;
        console.log(k+':', m[1].trim().slice(0,200));
      }
      if(!found) console.log(k+': (not found)');
    }
  }catch(e){ console.error(e && e.message || e); }
})();
