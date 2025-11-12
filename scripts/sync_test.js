const crypto = require('crypto');
const https = require('https');
const ts = Date.now();
const secret = 'huangjiaji199011280016';
const sig = crypto.createHash('sha256').update(`${ts}|${secret}`).digest('hex');
const options = {
  hostname: 'app-tau-gilt-23.vercel.app',
  path: '/api/sync/list',
  method: 'GET',
  headers: {
    'X-Ts': String(ts),
    'X-Sync-Signature': sig
  }
};

const req = https.request(options, (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', JSON.stringify(res.headers));
    console.log('BODY:', d);
  });
});
req.on('error', (e) => { console.error('ERROR', e.message); });
req.end();
