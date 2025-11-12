// Lightweight debug endpoint: /api/debug/mongo
// Attempts to connect to MongoDB using process.env.MONGODB_URI and returns a short status.
// Safe for production: does not echo the full URI or credentials, only presence and truncated info.

module.exports = async (req, res) => {
  const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });

  const uri = process.env.MONGODB_URI || null;
  if (!uri) return json(200, { ok: false, reason: 'no_mongodb_uri', message: 'MONGODB_URI not set in environment' });

  // Do not expose full URI; show a short fingerprint
  const fingerprint = uri.slice(0, 30) + (uri.length > 30 ? '...' : '');

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    await client.connect();

    // run a light ping
    const dbName = process.env.MONGODB_DB || 'usdt_trading';
    const db = client.db(dbName);
    try {
      await db.command({ ping: 1 });
    } catch (e) {
      // still consider connection established if ping fails differently
    }

    await client.close();

    return json(200, { ok: true, uriFingerprint: fingerprint, db: dbName, message: 'connected' });
  } catch (e) {
    // truncate error message to avoid leaking sensitive details
    const msg = (e && e.message) ? e.message.toString().substring(0, 300) : 'unknown error';
    return json(200, { ok: false, uriFingerprint: fingerprint, error: msg });
  }
};
// Debug endpoint: /api/debug/mongo
// Purpose: run from Vercel to check DNS resolution and MongoDB connectivity
// Returns JSON with DNS lookup results and a boolean indicating whether a Mongo connection succeeded.

const dns = require('dns').promises;

function json(res, status, data){ res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const uri = process.env.MONGODB_URI || '';
  const dbName = process.env.MONGODB_DB || 'usdt_trading';

  if (!uri) return json(res, 400, { ok:false, error: 'MONGODB_URI not set in environment' });

  // Try to extract host list from URI (works for non-SRV standard URIs)
  let hostPart = '';
  try {
    const m = uri.match(/^[^:]+:\/\/(?:[^@]+@)?([^\/?]+)/);
    hostPart = m && m[1] ? m[1] : '';
  } catch (e) {
    hostPart = '';
  }

  const hosts = hostPart ? hostPart.split(',').map(h => h.trim()).filter(Boolean) : [];

  const dnsResults = [];
  for (const h of hosts) {
    // h may be host:port
    const hostOnly = h.split(':')[0];
    try {
      const addrs = await dns.lookup(hostOnly, { all: true });
      dnsResults.push({ host: hostOnly, resolved: true, addresses: addrs.map(a=>a.address) });
    } catch (e) {
      dnsResults.push({ host: hostOnly, resolved: false, error: String(e && e.message ? e.message : e) });
    }
  }

  // Attempt MongoDB connection (safe, short timeout). Do not echo URI back.
  let mongoConnect = { success: false };
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db(dbName);
    let count = null;
    try { count = await db.collection('synced_users').countDocuments(); } catch (e) { /* ignore */ }
    await client.close();
    mongoConnect = { success: true, db: dbName, synced_users_count: (typeof count === 'number' ? count : null) };
  } catch (e) {
    mongoConnect = { success: false, error: (e && e.message) ? e.message : String(e) };
  }

  return json(res, 200, {
    ok: true,
    uri_present: !!uri,
    uri_length: uri.length,
    db: dbName,
    hosts,
    dnsResults,
    mongoConnect
  });
};
