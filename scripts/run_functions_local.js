// Simple local runner for functions/* handlers
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3002;
const functionsDir = path.join(__dirname, '..', 'functions');

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || '', true);
  const match = parsed.pathname && parsed.pathname.match(/^\/api\/(.*)$/);
  if (!match) {
    res.statusCode = 404; res.end('not found'); return;
  }
  const fname = match[1];
  const filePath = path.join(functionsDir, fname + '.js');
  if (!fs.existsSync(filePath)) { res.statusCode = 404; res.end('function not found'); return; }
  try {
    delete require.cache[require.resolve(filePath)];
    const handler = require(filePath);
    if (typeof handler !== 'function') { res.statusCode = 500; res.end('invalid handler'); return; }
    handler(req, res);
  } catch (e) {
    console.error('local runner error', e && e.stack || e);
    res.statusCode = 500; res.end('internal');
  }
});

server.listen(port, () => console.log('Local functions runner listening on http://localhost:' + port));
