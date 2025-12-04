const crypto = require('crypto');
const https = require('https');

// 配置（与仓库中脚本相同的签名 secret）
const secret = process.env.SYNC_SECRET || 'huangjiaji199011280016';
const hostname = process.env.SYNC_HOSTNAME || 'app-tau-gilt-23.vercel.app';
const path = process.env.SYNC_PATH || '/api/sync/platform-deposit';

const payloadObj = {
  ts: Date.now(),
  platformDeposit: {
    address: 'TAxVgpjRQeRBrH7oSY8KxkVJwNx82u5e8Y',
    qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=TAxVgpjRQeRBrH7oSY8KxkVJwNx82u5e8Y',
    note: 'published by script',
    updatedAt: Date.now()
  }
};

const bodyStr = JSON.stringify(payloadObj);
const sig = crypto.createHash('sha256').update(bodyStr + '|' + secret).digest('hex');

const options = {
  hostname: hostname,
  path: path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyStr),
    'X-Sync-Signature': sig
  }
};

console.log('Posting to', hostname + path);

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
