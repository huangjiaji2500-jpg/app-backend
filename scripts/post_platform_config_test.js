const https = require('https');

const payload = {
  displayRates: { USD: 1.23, CNY: 8.5, KRW: 1350, JPY: 150 },
  platformDeposit: {
    address: 'TEST_ADDR_12345',
    note: '测试：仅接收 USDT (TRC20)',
    qrImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA\nAAAFCAYAAACNbyblAAAAHElEQVQI12P4\n9/wHAAwDAwMDAwMDAwMDAwMDCwAAACV\nSURBVBhXY2AAAAACAAHiIbwzAAAAAElFTkSuQmCC'
  },
  syncAll: true
};

const body = JSON.stringify(payload);
const opts = {
  hostname: 'app-tau-gilt-23.vercel.app',
  port: 443,
  path: '/api/admin/set-platform-config',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-admin-secret': process.env.SYNC_SECRET || ''
  }
};

console.log('Posting to /api/admin/set-platform-config with syncAll=true');

const req = https.request(opts, (res) => {
  let d=''; res.on('data', c=> d+=c); res.on('end', ()=>{
    console.log('status', res.statusCode);
    try { console.log('body', JSON.parse(d)); } catch(e){ console.log('body', d); }
  });
});
req.on('error', (e)=> console.error('request error', e));
req.write(body);
req.end();
