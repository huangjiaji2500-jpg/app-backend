// /api/sync/rate
// Insert or upsert a rate record; keep latest values by base+quote

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

let MEMORY = { rates: [] };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error:'method_not_allowed' });
  const bodyStr = await bufferToString(req);
  let payload; try{ payload = JSON.parse(bodyStr); } catch { return json(res, 400, { error:'invalid_json' }); }
  const { ts, rate } = payload || {};
  if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return json(res, 400, { error:'timestamp_skew' });
  const secret = process.env.SYNC_SECRET || '';
  const signature = req.headers['x-sync-signature'] || '';
  const expected = sha256(bodyStr + '|' + secret);
  if (!secret || signature !== expected) return json(res, 403, { error:'bad_signature' });
  if (!rate || !rate.base || !rate.quote) return json(res, 400, { error:'invalid_rate' });
  rate.syncedAt = Date.now();
  let persisted = false;
  console.log('[sync/rate] incoming rate write', { base: rate.base, quote: rate.quote, value: rate.value, envHasMongo: !!process.env.MONGODB_URI });
  try {
    // try firestore first
    const fs = getFirestore();
    if (fs){
      try{
        const docId = `${rate.base}_${rate.quote}`;
        await fs.collection('synced_rates').doc(docId).set(rate, { merge: true });
        persisted = true;
        console.log('[sync/rate] write persisted to firestore', { base: rate.base, quote: rate.quote });
      }catch(e){
        console.log('[sync/rate] firestore write error', e && e.message);
      }
    }
    if (!persisted){
      const mg = await getMongo();
      if (mg){
        try{
          const col = mg.db.collection('synced_rates');
          await col.updateOne({ base: rate.base, quote: rate.quote }, { $set: rate }, { upsert: true });
          persisted = true;
          console.log('[sync/rate] write persisted to mongo', { base: rate.base, quote: rate.quote });
        }catch(e){ console.log('[sync/rate] mongo write error', e && e.message); }
      }
    }
  } catch(e){ console.log('[sync/rate] unexpected error', e && e.message); }
  if (!persisted){
    const idx = MEMORY.rates.findIndex(r => r.base===rate.base && r.quote===rate.quote);
    if (idx >= 0) MEMORY.rates[idx] = rate; else MEMORY.rates.push(rate);
    console.log('[sync/rate] persisted to memory fallback', { base: rate.base, quote: rate.quote });
  }
  return json(res, 200, { ok:true });
};
