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
    const j = JSON.parse(r.body);
    const payments = j.payments || [];
    console.log('payments count=', payments.length);
    for(const it of payments){
      const payload = it.payload || {};
      const item = payload.item || payload.deposit || payload || {};
      const username = item.username || item.user || it.username || payload.username || 'unknown';
      const requested = Number(item.amountRequestedUSDT || item.amountRequested || item.amount || payload.amount || 0) || 0;
      const approved = Number(item.amountApprovedUSDT || item.amountApproved || 0) || 0;
      // detect proof image presence
      const proof = item.proofImage || item.proofImageUrl || item.receiptUrl || item.receiptViewUrl || (item.images && item.images[0]) || (item.attachments && item.attachments[0]) || it.receiptUrl || it.receiptViewUrl || payload.proofImage || null;
      const hasProof = !!proof;
      const docId = it._id || it.id || (item.id) || '-';
      const status = it.status || item.status || payload.status || 'pending';
      const createdRaw = it.receivedAt || it.createdAt || payload.receivedAt || payload.createdAt || item.createdAt || item.ts || null;
      const created = createdRaw ? new Date(Number(createdRaw) || createdRaw).toISOString() : '-';
      console.log('---');
      console.log('docId:', docId);
      console.log('username:', username);
      console.log('requested:', requested);
      console.log('approved:', approved);
      console.log('hasProof:', hasProof);
      console.log('proofSnippet:', hasProof ? (typeof proof === 'string' ? (proof.slice(0,80) + (proof.length>80? '...':'') ) : JSON.stringify(proof).slice(0,80)) : '-');
      console.log('status:', status);
      console.log('created:', created);
    }
  }catch(e){ console.error(e && e.message || e); }
})();
