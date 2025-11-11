// /api/sync/user
// Upsert a user meta document (no sensitive fields)

const MAX_SKEW_MS = 120000;
function sha256(str){ const crypto = require('crypto'); return crypto.createHash('sha256').update(str).digest('hex'); }
let mongoCached = null;
async function getMongo(){
  if (mongoCached) return mongoCached;
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'usdt_trading');
  mongoCached = { client, db };
  return mongoCached;
}
function json(res, status, data){ res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }
async function bufferToString(req){ return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>resolve(raw)); req.on('error',reject); }); }

let MEMORY = { users: [] };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error:'method_not_allowed' });
  const bodyStr = await bufferToString(req);
  let payload; try{ payload = JSON.parse(bodyStr); } catch { return json(res, 400, { error:'invalid_json' }); }
  const { ts, user } = payload || {};
  if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return json(res, 400, { error:'timestamp_skew' });
  const secret = process.env.SYNC_SECRET || '';
  const signature = req.headers['x-sync-signature'] || '';
  const expected = sha256(bodyStr + '|' + secret);

  // Debug logging (temporary) - prints headers, body and partial signature to Vercel logs
  try {
    // Avoid printing secret. Print incoming signature and a short part of expected for comparison
    console.log('SYNC DEBUG headers:', JSON.stringify(req.headers || {}));
    console.log('SYNC DEBUG bodyStr:', bodyStr);
    console.log('SYNC DEBUG ts:', ts, 'incomingSig:', signature, 'expectedPrefix:', (expected || '').slice(0,12));
  } catch (e) { /* ignore logging errors */ }

  if (!secret || signature !== expected) return json(res, 403, { error:'bad_signature' });
  if (!user || !user.username) return json(res, 400, { error:'invalid_user' });
  user.syncedAt = Date.now();
  let persisted = false;
  try {
    const mg = await getMongo();
    if (mg){
      const col = mg.db.collection('synced_users');
      await col.updateOne({ username: user.username }, { $set: user }, { upsert: true });
      persisted = true;
    }
  } catch {}
  if (!persisted) {
    const idx = MEMORY.users.findIndex(u => u.username === user.username);
    if (idx >= 0) MEMORY.users[idx] = user; else MEMORY.users.push(user);
  }
  return json(res, 200, { ok:true });
};
