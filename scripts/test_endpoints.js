const https = require('https');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

const base = process.env.BASE_URL || 'http://localhost:3002';

function request(cfg){
  return new Promise((resolve, reject)=>{
    const u = url.parse(cfg.url);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = { method: cfg.method||'GET', hostname: u.hostname, port: u.port, path: u.path, headers: cfg.headers||{} };
    console.log('[test] request start', opts.method, cfg.url);
    const req = lib.request(opts, (res)=>{
      let d=''; res.on('data', c=> d+=c); res.on('end', ()=>{
        console.log('[test] request end', opts.method, cfg.url, 'status=', res.statusCode);
        resolve({ status: res.statusCode, headers: res.headers, body: d });
      });
    });
    req.on('error', (err)=>{
      console.error('[test] request error', opts.method, cfg.url, err && err.message || err);
      reject(err);
    });
    // add a 10s socket timeout to avoid hanging
    req.setTimeout(10000, ()=>{
      req.abort();
    });
    if (cfg.body) req.write(cfg.body);
    req.end();
  });
}

async function run(){
  console.log('Testing endpoints against', base);
  const syncSecret = process.env.SYNC_SECRET || '';
  const tests = [
    { name:'/api/register', url: base + '/api/register', method:'POST', body: JSON.stringify({ username: 'testuser_local', password: 'pass1234' }), headers: {'Content-Type':'application/json'} },
    { name:'/api/login', url: base + '/api/login', method:'POST', body: JSON.stringify({ username: 'testuser_local', password: 'pass1234' }), headers: {'Content-Type':'application/json'} },
    { name:'/api/me (needs token)', url: base + '/api/me', method:'GET', headers: {} },
    { name:'/api/public/platform-config', url: base + '/api/public/platform-config', method:'GET' },
    // signed POST to sync/deposit
    { name:'/api/sync/deposit', url: base + '/api/sync/deposit', method:'POST', body: JSON.stringify({ action:'test', ts: Date.now(), item: { username:'testuser_local', amountRequestedUSDT:1, status:'pending' }}), headers: {'Content-Type':'application/json'}, signed:true },
    // signed GET to sync/list
    { name:'/api/sync/list', url: base + '/api/sync/list', method:'GET', signedList:true }
  ];

  let lastToken = null;
  for (const t of tests){
    try {
      console.log('\n->', t.name);
      // Prepare signing if required
      if (t.signed) {
        const payload = JSON.parse(t.body || '{}');
        if (!syncSecret) console.warn('SYNC_SECRET not set; signed request may be rejected');
        const sig = crypto.createHash('sha256').update(JSON.stringify(payload) + '|' + syncSecret).digest('hex');
        t.headers = t.headers || {};
        t.headers['X-Sync-Signature'] = sig;
      }
      if (t.signedList) {
        const ts = Date.now();
        if (!syncSecret) console.warn('SYNC_SECRET not set; signed request may be rejected');
        const sig = crypto.createHash('sha256').update(String(ts) + '|' + syncSecret).digest('hex');
        t.headers = t.headers || {};
        t.headers['X-Ts'] = String(ts);
        t.headers['X-Sync-Signature'] = sig;
      }
      const resp = await request(t);
      console.log('status:', resp.status);
      try { console.log('body:', JSON.parse(resp.body)); } catch(e){ console.log('body:', resp.body); }
      // capture token from login
      if (t.name === '/api/login' && resp.status === 200) {
        try { const json = JSON.parse(resp.body); if (json && json.token) lastToken = json.token; } catch(e){}
      }
      if (t.name === '/api/me (needs token)'){
        if (!lastToken){ console.log('skipping /api/me: no token obtained from login'); continue; }
        const r2 = await request({ url: t.url, method:'GET', headers: { Authorization: 'Bearer ' + lastToken } });
        console.log('status:', r2.status);
        try { console.log('body:', JSON.parse(r2.body)); } catch(e){ console.log('body:', r2.body); }
      }
    } catch (e){ console.error('error testing', t.name, e && e.message || e); }
  }
}

run().catch(e=> console.error(e));
