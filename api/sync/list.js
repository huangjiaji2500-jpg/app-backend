// Dedicated endpoint: /api/sync/list
// redeploy: force a new Vercel deployment
// 作用：避免动态 catch-all 未被 Vercel 正确拾取时导致 404，提供明确的 list 路由。

const MAX_SKEW_MS = 120000;
function sha256(str){ const crypto = require('crypto'); return crypto.createHash('sha256').update(str).digest('hex'); }
// Shared in-memory fallback (shared module so multiple routes in same process see same data)
const MEMORY = require('../../lib/inmemory');
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
module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error:'method_not_allowed' });
  const tsStr = (req.headers['x-ts']||'').toString();
  const ts = Number(tsStr);
  if (!ts || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return json(res, 403, { error:'bad_signature', message:'签名错误' });
  }
  const secret = process.env.SYNC_SECRET || '';
  const signature = req.headers['x-sync-signature'] || '';
  const expected = sha256(tsStr + '|' + secret);
  if (!secret || signature !== expected) {
    return json(res, 403, { error:'bad_signature', message:'签名错误' });
  }
  try {
    const mg = await getMongo();
    if (mg){
      const orders = await mg.db.collection('synced_orders').find({}).sort({ _id:-1 }).limit(200).toArray();
      const deposits = await mg.db.collection('synced_deposits').find({}).sort({ _id:-1 }).limit(200).toArray();
      const users = await mg.db.collection('synced_users').find({}).sort({ _id:-1 }).limit(200).toArray();
      const rates = await mg.db.collection('synced_rates').find({}).sort({ _id:-1 }).limit(5).toArray();
      const paymentMethods = await mg.db.collection('synced_payment_methods').find({}).sort({ _id:-1 }).limit(200).toArray();
      let platformDeposit = null;
      try {
        const arr = await mg.db.collection('synced_platform_config').find({}).sort({ _id:-1 }).limit(1).toArray();
        platformDeposit = arr[0] || null;
      } catch {}
      return json(res, 200, { ok:true, orders, deposits, users, rates, paymentMethods, platformDeposit });
    }
  } catch {}
  return json(res, 200, {
    ok:true,
    orders: MEMORY.orders.slice(-200),
    deposits: MEMORY.deposits.slice(-200),
    users: MEMORY.users.slice(-200),
    rates: MEMORY.rates.slice(-5),
    paymentMethods: MEMORY.paymentMethods.slice(-200),
    platformDeposit: MEMORY.platformDeposit
  });
};
