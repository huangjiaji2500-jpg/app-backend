// Catch-all: /api/sync/* 处理 POST /order、/deposit；也可兜底 GET /list
const MAX_SKEW_MS = 120000;
function sha256(str){ const crypto = require('crypto'); return crypto.createHash('sha256').update(str).digest('hex'); }

let MEMORY = { orders: [], deposits: [] };
let mongoCached = null;
async function getMongo(){
  if (mongoCached) return mongoCached;
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS:5000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'usdt_trading');
  mongoCached = { client, db };
  return mongoCached;
}
function json(res, status, data){ res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }
async function bufferToString(req){
  return new Promise((resolve, reject)=>{
    let raw=''; req.on('data', c=> raw+=c); req.on('end', ()=>resolve(raw)); req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  const url = req.url || '';

  // 兜底 GET /api/sync/list（若没有单独 list.js 时仍可用）
  if (req.method === 'GET' && url.startsWith('/api/sync/list')) {
    const tsStr = (req.headers['x-ts']||'').toString();
    const ts = Number(tsStr);
    if (!ts || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return json(res, 403, { error:'bad_signature', message:'签名错误' });
    const secret = process.env.SYNC_SECRET || '';
    const signature = req.headers['x-sync-signature'] || '';
    const expected = sha256(tsStr + '|' + secret);
    if (!secret || signature !== expected) return json(res, 403, { error:'bad_signature', message:'签名错误' });

    try {
      const mg = await getMongo();
      if (mg){
        const orders = await mg.db.collection('synced_orders').find({}).sort({ _id:-1 }).limit(200).toArray();
        const deposits = await mg.db.collection('synced_deposits').find({}).sort({ _id:-1 }).limit(200).toArray();
        return json(res, 200, { ok:true, orders, deposits });
      }
    } catch {}
    return json(res, 200, { ok:true, orders: MEMORY.orders.slice(-200), deposits: MEMORY.deposits.slice(-200) });
  }

  if (req.method !== 'POST') return json(res, 404, { error:'not_found' });

  const bodyStr = await bufferToString(req);
  let payload; try { payload = JSON.parse(bodyStr); } catch { return json(res, 400, { error:'invalid_json' }); }
  const { ts, type } = payload || {};
  if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return json(res, 400, { error:'timestamp_skew' });

  const secret = process.env.SYNC_SECRET || '';
  const signature = req.headers['x-sync-signature'] || '';
  const expected = sha256(bodyStr + '|' + secret);
  if (!secret || signature !== expected) return json(res, 403, { error:'bad_signature' });

  if (type === 'order' || type === 'deposit') {
    const doc = type === 'order' ? { ...payload.order } : { ...payload.deposit };
    doc.syncedAt = Date.now();
    let persisted = false;
    try {
      const mg = await getMongo();
      if (mg){
        const col = mg.db.collection(type === 'order' ? 'synced_orders' : 'synced_deposits');
        await col.insertOne(doc);
        persisted = true;
      }
    } catch {}
    if (!persisted){ if (type === 'order') MEMORY.orders.push(doc); else MEMORY.deposits.push(doc); }
    return json(res, 200, { ok:true });
  }

  return json(res, 400, { error:'unknown_type' });
};
