// Public endpoint: /api/public/platform-config
// Returns minimal public configuration used by clients: displayRates and platformDeposit
const DEFAULT_DISPLAY = { USD:1, CNY:11, KRW:2250, JPY:237 };
async function getMongo(){
  let mongoCached = null;
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

function json(res, status, data){ res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error:'method_not_allowed' });
  try {
    // prefer Firestore when configured
    const { getFirestore } = require('../../lib/firestore');
    const fs = getFirestore();
    if (fs){
      console.log('[public/platform-config] using firestore');
      let displayRates = { ...DEFAULT_DISPLAY };
      try{
        const snap = await fs.collection('synced_rates').get();
        snap.forEach(d => {
          const r = d.data();
          try{
            const quote = (r.quote||'').toString().toUpperCase();
            const val = Number(r.value);
            if (isNaN(val) || val <= 0) return;
            if (quote === 'CNY') displayRates.CNY = val;
            else if (quote === 'KRW') displayRates.KRW = val;
            else if (quote === 'JPY') displayRates.JPY = val;
            else if (quote === 'USD') displayRates.USD = val;
          }catch(e){ console.log('[public/platform-config] parse rate error', e && e.message); }
        });
      }catch(e){ console.log('[public/platform-config] read rates error', e && e.message); }
      let platformDeposit = null;
      try{
        const doc = await fs.collection('synced_platform_config').doc('platform').get();
        if (doc && doc.exists) platformDeposit = doc.data();
      }catch(e){ console.log('[public/platform-config] read platform config error', e && e.message); }
      return json(res, 200, { ok:true, displayRates, platformDeposit, debug:{ source:'firestore', envHasFirestore: true } });
    }
    // fallback to mongo if firestore not available
    const mg = await getMongo();
    if (mg) {
      // read latest rates and platform deposit
      let displayRates = { ...DEFAULT_DISPLAY };
      try {
        const rates = await mg.db.collection('synced_rates').find({}).toArray();
        for (const r of rates || []) {
          try {
            const quote = (r.quote||'').toString().toUpperCase();
            const val = Number(r.value);
            if (isNaN(val) || val <= 0) continue;
            if (quote === 'CNY') displayRates.CNY = val;
            else if (quote === 'KRW') displayRates.KRW = val;
            else if (quote === 'JPY') displayRates.JPY = val;
            else if (quote === 'USD') displayRates.USD = val;
          } catch(e){ console.log('[public/platform-config] parse rate error', e && e.message); }
        }
      } catch(e){ console.log('[public/platform-config] read rates error', e && e.message); }
      let platformDeposit = null;
      try {
        const arr = await mg.db.collection('synced_platform_config').find({}).sort({ _id:-1 }).limit(1).toArray();
        platformDeposit = arr[0] || null;
      } catch(e){ console.log('[public/platform-config] read platform config error', e && e.message); }
      // include a short-lived debug field so we can see if response used mongo
      return json(res, 200, { ok:true, displayRates, platformDeposit, debug:{ source:'mongo', envHasMongo: !!process.env.MONGODB_URI } });
    }
  } catch(e){ console.log('[public/platform-config] outer error', e && e.message); }
  // Fallback to memory if no mongo
  try {
    const MEM = require('../../lib/inmemory');
    const displayRates = { ...DEFAULT_DISPLAY };
    for (const r of MEM.rates || []){
      const quote = (r.quote||'').toString().toUpperCase();
      const val = Number(r.value);
      if (isNaN(val) || val <= 0) continue;
      if (quote === 'CNY') displayRates.CNY = val;
      else if (quote === 'KRW') displayRates.KRW = val;
      else if (quote === 'JPY') displayRates.JPY = val;
      else if (quote === 'USD') displayRates.USD = val;
    }
    console.log('[public/platform-config] falling back to memory');
    return json(res, 200, { ok:true, displayRates, platformDeposit: MEM.platformDeposit || null, debug:{ source:'memory', envHasMongo: !!process.env.MONGODB_URI } });
  } catch(e) { return json(res, 200, { ok:true, displayRates: DEFAULT_DISPLAY, platformDeposit: null }); }
};
