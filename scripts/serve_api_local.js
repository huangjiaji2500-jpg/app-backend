// Simple local server to serve files under ./api as HTTP endpoints for testing
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3002;
const apiDir = path.join(__dirname, '..', 'api');

function findHandlerFile(reqPath){
  // reqPath like /api/login or /api/sync/list or /api/public/platform-config
  if (!reqPath.startsWith('/api/')) return null;
  const rel = reqPath.slice('/api/'.length);
  const parts = rel.split('/').filter(Boolean);
  // Try direct file: api/<rel>.js
  const tryPaths = [];
  tryPaths.push(path.join(apiDir, rel + '.js'));
  // If nested (public/platform-config) try api/public/platform-config.js
  tryPaths.push(path.join(apiDir, ...parts) + '.js');
  // fallback: index.js in directory
  tryPaths.push(path.join(apiDir, ...parts, 'index.js'));
  for (const p of tryPaths){ if (fs.existsSync(p)) return p; }
  return null;
}

function isNetlifyHandler(mod){
  return mod && typeof mod.handler === 'function';
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || '', true);
  console.log('[local-api] incoming', req.method, parsed.pathname);
  const file = findHandlerFile(parsed.pathname || '');
  if (!file) { res.statusCode = 404; res.end('not found'); return; }
  try {
    delete require.cache[require.resolve(file)];
    const mod = require(file);
    // Read body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    if (rawBody && rawBody.length) console.log('[local-api] body:', rawBody.slice(0,200));
    // Normalize headers keys to lower-case
    const headers = {};
    Object.keys(req.headers||{}).forEach(k=> headers[k] = req.headers[k]);

    if (isNetlifyHandler(mod)){
      // Netlify style expects event, context
      const event = {
        httpMethod: req.method,
        headers: headers,
        queryStringParameters: parsed.query || {},
        body: rawBody || null,
        path: parsed.pathname,
      };
      const result = await mod.handler(event, {});
      res.statusCode = result.statusCode || 200;
      const outHeaders = result.headers || {};
      Object.keys(outHeaders).forEach(k=> res.setHeader(k, outHeaders[k]));
      res.end(result.body || '');
      return;
    }

    // Otherwise expect function(req,res) or module.exports = async (req,res)
    // Provide parsed body as object if JSON
    let body = rawBody;
    try { body = rawBody && rawBody.length ? JSON.parse(rawBody) : {}; } catch(e){ /* keep raw string */ }
    // attach body to req for handlers that expect req.body
    req.body = body;
    // Some handlers look for req.headers.Authorization etc. Ensure headers available
    req.headers = headers;
    // Call handler
    const handler = typeof mod === 'function' ? mod : (mod.default || mod.handler || mod);
    // Provide a small wrapper res to capture setHeader/statusCode/end
    const fakeRes = new Proxy(res, {
      get(target, prop){
        const val = target[prop];
        if (typeof val === 'function') return val.bind(target);
        return val;
      }
    });

    // Call handler but add a timeout so a hung handler doesn't keep socket open
    const handlerPromise = (async () => {
      const maybe = handler(req, fakeRes);
      if (maybe && typeof maybe.then === 'function') await maybe;
    })();

    const timed = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('handler_timeout')), 8000);
      handlerPromise.then(() => { clearTimeout(to); resolve(); }).catch(err => { clearTimeout(to); reject(err); });
    });

    try {
      await timed;
    } catch (e) {
      if (e && e.message === 'handler_timeout') {
        console.error('[local-api] handler timeout for', parsed.pathname);
        if (!res.writableEnded) {
          res.statusCode = 504;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'handler_timeout' }));
        }
      } else {
        console.error('local api handler error', e && (e.stack || e.message));
        if (!res.writableEnded) { res.statusCode = 500; res.end('internal'); }
      }
    }
    // If the handler didn't call res.end, ensure it's ended
    if (!res.writableEnded) res.end();
  } catch (e) {
    console.error('local api error', e && e.stack || e);
    res.statusCode = 500; res.end('internal');
  }
});

server.listen(port, ()=> console.log('Local API server listening on http://localhost:' + port));
