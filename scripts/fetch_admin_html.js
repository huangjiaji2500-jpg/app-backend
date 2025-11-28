const https = require('https');
const url = 'https://app-9ppb7ic5c-linlins-projects-0f242d73.vercel.app/admin/index.html';

function request(url){
  return new Promise((resolve,reject)=>{
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port || 443, path: u.pathname + (u.search||''), method: 'GET' };
    const req = https.request(opts, res=>{
      let d=''; res.on('data', c=> d+=c); res.on('end', ()=> resolve({status:res.statusCode, body:d}));
    });
    req.on('error', reject);
    req.end();
  });
}

(async ()=>{
  try{
    const r = await request(url);
    console.log('status', r.status);
    const b = r.body;
    const markers = ['amountApprovedUSDT','amountRequestedUSDT','approved-amount','input name="amountApprovedUSDT"','id="approvedAmount"'];
    for(const m of markers){
      console.log(m+':', b.indexOf(m) !== -1);
    }
    // print first 400 chars
    console.log('\n--- head ---\n', b.slice(0,800));
  }catch(e){ console.error(e && e.message); }
})();
