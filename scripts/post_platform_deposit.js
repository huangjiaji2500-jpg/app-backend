const crypto = require('crypto');
const https = require('https');
const secret = 'huangjiaji199011280016';
const payloadObj = {
  ts: Date.now(),
  platformDeposit: {
    address: 'TK_ADMIN_TEST_ADDRESS',
    qrImage: '',
    note: 'test from script',
    updatedAt: Date.now()
  }
};
const bodyStr = JSON.stringify(payloadObj);
const sig = crypto.createHash('sha256').update(bodyStr + '|' + secret).digest('hex');

const options = {
  hostname: 'app-tau-gilt-23.vercel.app',
  path: '/api/sync/platform-deposit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyStr),
    'X-Sync-Signature': sig
  }
};

const req = https.request(options, (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', d);
  });
});
req.on('error', (e) => { console.error('ERROR', e.message); });
req.write(bodyStr);
req.end();
