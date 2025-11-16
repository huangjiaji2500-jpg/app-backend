export default async function handler(req, res) {
  const action = req.query.action;

  // ========== last-admin-post.js ==========
  if (action === 'last-admin-post') {
    const { getFirestore } = require('../../lib/firestore');
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
      const platformDocRef = db.doc('platform/platform');
      const [platformSnap, debugQuerySnap] = await Promise.all([
        platformDocRef.get(),
        db.collection('platform_debug_history').orderBy('ts', 'desc').limit(10).get(),
      ]);
      const debugEntries = [];
      debugQuerySnap.forEach(d => debugEntries.push({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok: true, debugEntries, platform: platformSnap.exists ? platformSnap.data() : null });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'internal' });
    }
  }

  // ========== mongo.js ==========
  if (action === 'mongo') {
    const dns = require('dns').promises;
    function json(res, status, data){ res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
    const uri = process.env.MONGODB_URI || '';
    const dbName = process.env.MONGODB_DB || 'usdt_trading';
    if (!uri) return json(res, 400, { ok:false, error: 'MONGODB_URI not set in environment' });
    let hostPart = '';
    try {
      const m = uri.match(/^[^:]+:\/\/(?:[^@]+@)?([^/?]+)/);
      hostPart = m && m[1] ? m[1] : '';
    } catch (e) { hostPart = ''; }
    const hosts = hostPart ? hostPart.split(',').map(h => h.trim()).filter(Boolean) : [];
    const dnsResults = [];
    for (const h of hosts) {
      const hostOnly = h.split(':')[0];
      try {
        const addrs = await dns.lookup(hostOnly, { all: true });
        dnsResults.push({ host: hostOnly, resolved: true, addresses: addrs.map(a=>a.address) });
      } catch (e) {
        dnsResults.push({ host: hostOnly, resolved: false, error: String(e && e.message ? e.message : e) });
      }
    }
    let mongoConnect = { success: false };
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db(dbName);
      let count = null;
      try { count = await db.collection('synced_users').countDocuments(); } catch (e) { }
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
  }

  res.status(400).json({ error: 'Unknown action' });
}
