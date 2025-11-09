// /api/sync/list 仅 GET：返回已同步的订单与充值（需签名；缺失视为签名错误）
// 如果未配置 SYNC_SECRET 或签名不匹配，返回 403 + 签名错误。

const MAX_SKEW_MS = 120000; // 允许时间戳偏差 120 秒
function sha256(str){
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str).digest('hex');
}

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

function json(res, status, data){
  res.statusCode = status;
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error:'method_not_allowed' });

  const tsStr = (req.headers['x-ts']||'').toString();
  const ts = Number(tsStr);
  // 无时间戳或偏差过大 → 签名错误（统一给用户可见的文案）
  if (!ts || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return json(res, 403, { error:'bad_signature', message:'签名错误' });
  }

  const secret = process.env.SYNC_SECRET || '';
  const signature = req.headers['x-sync-signature'] || '';
  const expected = sha256(tsStr + '|' + secret);
  if (!secret || signature !== expected) {
    return json(res, 403, { error:'bad_signature', message:'签名错误' });
  }

  // 读取 Mongo（可选），没有就用内存
  try {
    const mg = await getMongo();
    if (mg){
      const orders = await mg.db.collection('synced_orders').find({}).sort({ _id:-1 }).limit(200).toArray();
      const deposits = await mg.db.collection('synced_deposits').find({}).sort({ _id:-1 }).limit(200).toArray();
      return json(res, 200, { ok:true, orders, deposits });
    }
  } catch {}

  return json(res, 200, { ok:true, orders: MEMORY.orders.slice(-200), deposits: MEMORY.deposits.slice(-200) });
};
// redeploy trigger at <时间>
