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
          } catch(e){}
        }
      } catch(e){}
      let platformDeposit = null;
      try {
        const arr = await mg.db.collection('synced_platform_config').find({}).sort({ _id:-1 }).limit(1).toArray();
        platformDeposit = arr[0] || null;
      } catch(e){ console.log('[public/platform-config] read platform config error', e && e.message); }
      console.log('[public/platform-config] returning mongo-sourced config');
      return json(res, 200, { ok:true, displayRates, platformDeposit, debug:{ source:'mongo', envHasMongo: !!process.env.MONGODB_URI } });
    }
  } catch(e){}
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
