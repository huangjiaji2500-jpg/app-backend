// /api/sync/platform-deposit
// Upsert single platform deposit config (address / qrImage / note)

const MAX_SKEW_MS = 120000;
function sha256(str){ const crypto = require('crypto'); return crypto.createHash('sha256').update(str).digest('hex'); }
// prefer Firestore when configured; fallback to MongoDB when FIREBASE_SERVICE_ACCOUNT not present
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
const { getFirestore } = require('../../lib/firestore');
function json(res, status, data){ res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }
async function bufferToString(req){ return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>resolve(raw)); req.on('error',reject); }); }

let MEMORY = { platformDeposit: null };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error:'method_not_allowed' });
  const bodyStr = await bufferToString(req);
  let payload; try{ payload = JSON.parse(bodyStr); } catch { return json(res, 400, { error:'invalid_json' }); }
  const { ts, platformDeposit } = payload || {};
  if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return json(res, 400, { error:'timestamp_skew' });
  const secret = process.env.SYNC_SECRET || '';
  const signature = req.headers['x-sync-signature'] || '';
  const expected = sha256(bodyStr + '|' + secret);
  if (!secret || signature !== expected) return json(res, 403, { error:'bad_signature' });
  if (!platformDeposit) return json(res, 400, { error:'invalid_platform_deposit' });
  platformDeposit.syncedAt = Date.now();
  let persisted = false;
  console.log('[sync/platform-deposit] incoming write', { envHasMongo: !!process.env.MONGODB_URI, address: platformDeposit.address ? 'has' : 'none' });
  try {
    // try firestore first
    const fs = getFirestore();
    if (fs){
      try{
        await fs.collection('synced_platform_config').doc('platform').set({ ...platformDeposit, _id:'platform' }, { merge: true });
        persisted = true;
        console.log('[sync/platform-deposit] write persisted to firestore');
      }catch(e){ console.log('[sync/platform-deposit] firestore write error', e && e.message); }
    }
    if (!persisted){
      const mg = await getMongo();
      if (mg){
        try{
          const col = mg.db.collection('synced_platform_config');
          // Keep only latest doc: upsert with a fixed key
          await col.updateOne({ _id:'platform' }, { $set: { ...platformDeposit, _id:'platform' } }, { upsert: true });
          persisted = true;
          console.log('[sync/platform-deposit] write persisted to mongo');
        }catch(e){ console.log('[sync/platform-deposit] mongo write error', e && e.message); }
      }
    }
  } catch(e){ console.log('[sync/platform-deposit] unexpected error', e && e.message); }
  if (!persisted){ MEMORY.platformDeposit = platformDeposit; console.log('[sync/platform-deposit] persisted to memory fallback'); }
  return json(res, 200, { ok:true });
};
