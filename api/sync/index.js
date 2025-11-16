export default async function handler(req, res) {
  const action = req.query.action;

  // ========== list.js ==========
  if (action === 'list') {
    const MAX_SKEW_MS = 120000;
    function sha256(str){
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(str).digest('hex');
    }
    const MEMORY = require('../../lib/inmemory');
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
      const { getFirestore } = require('../../lib/firestore');
      const fs = getFirestore();
      if (fs){
        const ordersSnap = await fs.collection('synced_orders').orderBy('_id','desc').limit(200).get().catch(()=>null);
        const depositsSnap = await fs.collection('synced_deposits').orderBy('_id','desc').limit(200).get().catch(()=>null);
        const usersSnap = await fs.collection('synced_users').orderBy('_id','desc').limit(200).get().catch(()=>null);
        const ratesSnap = await fs.collection('synced_rates').orderBy('_id','desc').limit(5).get().catch(()=>null);
        const paymentSnap = await fs.collection('synced_payment_methods').orderBy('_id','desc').limit(200).get().catch(()=>null);
        const orders = ordersSnap ? ordersSnap.docs.map(d=>d.data()) : [];
        const deposits = depositsSnap ? depositsSnap.docs.map(d=>d.data()) : [];
        const users = usersSnap ? usersSnap.docs.map(d=>d.data()) : [];
        const rates = ratesSnap ? ratesSnap.docs.map(d=>d.data()) : [];
        const paymentMethods = paymentSnap ? paymentSnap.docs.map(d=>d.data()) : [];
        let platformDeposit = null;
        try{
          const doc = await fs.collection('synced_platform_config').doc('platform').get();
          if (doc && doc.exists) platformDeposit = doc.data();
        }catch(e){}
        return json(res, 200, { ok:true, orders, deposits, users, rates, paymentMethods, platformDeposit, debug:{ source:'firestore', envHasFirestore: true } });
      }
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
        return json(res, 200, { ok:true, orders, deposits, users, rates, paymentMethods, platformDeposit, debug:{ source:'mongo', envHasMongo: !!process.env.MONGODB_URI } });
      }
    } catch(e){}
    return json(res, 200, {
      ok:true,
      orders: MEMORY.orders.slice(-200),
      deposits: MEMORY.deposits.slice(-200),
      users: MEMORY.users ? MEMORY.users.slice(-200) : [],
      rates: MEMORY.rates ? MEMORY.rates.slice(-5) : [],
      paymentMethods: MEMORY.paymentMethods ? MEMORY.paymentMethods.slice(-200) : [],
      platformDeposit: MEMORY.platformDeposit || null,
      debug:{ source:'memory', envHasMongo: !!process.env.MONGODB_URI }
    });
  }

  // ========== payment-method.js ==========
  if (action === 'payment-method') {
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
    let MEMORY = { paymentMethods: [] };
    if (req.method !== 'POST') return json(res, 405, { error:'method_not_allowed' });
    const bodyStr = await bufferToString(req);
    let payload; try{ payload = JSON.parse(bodyStr); } catch { return json(res, 400, { error:'invalid_json' }); }
    const { ts, paymentMethod } = payload || {};
    if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return json(res, 400, { error:'timestamp_skew' });
    const secret = process.env.SYNC_SECRET || '';
    const signature = req.headers['x-sync-signature'] || '';
    const expected = sha256(bodyStr + '|' + secret);
    if (!secret || signature !== expected) return json(res, 403, { error:'bad_signature' });
    if (!paymentMethod || !paymentMethod.id) return json(res, 400, { error:'invalid_payment_method' });
    paymentMethod.syncedAt = Date.now();
    let persisted = false;
    try {
      const mg = await getMongo();
      if (mg){
        const col = mg.db.collection('synced_payment_methods');
        await col.updateOne({ id: paymentMethod.id }, { $set: paymentMethod }, { upsert: true });
        persisted = true;
      }
    } catch {}
    if (!persisted){
      const idx = MEMORY.paymentMethods.findIndex(m => m.id === paymentMethod.id);
      if (idx >= 0) MEMORY.paymentMethods[idx] = paymentMethod; else MEMORY.paymentMethods.push(paymentMethod);
    }
    return json(res, 200, { ok:true });
  }

  // ========== platform-deposit.js ==========
  if (action === 'platform-deposit') {
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
    const { getFirestore } = require('../../lib/firestore');
    function json(res, status, data){ res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }
    async function bufferToString(req){ return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>resolve(raw)); req.on('error',reject); }); }
    let MEMORY = { platformDeposit: null };
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
    try {
      const fs = getFirestore();
      if (fs){
        try{
          await fs.collection('synced_platform_config').doc('platform').set({ ...platformDeposit, _id:'platform' }, { merge: true });
          persisted = true;
        }catch(e){}
      }
      if (!persisted){
        const mg = await getMongo();
        if (mg){
          try{
            const col = mg.db.collection('synced_platform_config');
            await col.updateOne({ _id:'platform' }, { $set: { ...platformDeposit, _id:'platform' } }, { upsert: true });
            persisted = true;
          }catch(e){}
        }
      }
    } catch(e){}
    if (!persisted){ MEMORY.platformDeposit = platformDeposit; }
    return json(res, 200, { ok:true });
  }

  // ========== rate.js ==========
  if (action === 'rate') {
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
    const { getFirestore } = require('../../lib/firestore');
    function json(res, status, data){ res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }
    async function bufferToString(req){ return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>resolve(raw)); req.on('error',reject); }); }
    let MEMORY = { rates: [] };
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
    try {
      const fs = getFirestore();
      if (fs){
        try{
          const docId = `${rate.base}_${rate.quote}`;
          await fs.collection('synced_rates').doc(docId).set(rate, { merge: true });
          persisted = true;
        }catch(e){}
      }
      if (!persisted){
        const mg = await getMongo();
        if (mg){
          try{
            const col = mg.db.collection('synced_rates');
            await col.updateOne({ base: rate.base, quote: rate.quote }, { $set: rate }, { upsert: true });
            persisted = true;
          }catch(e){}
        }
      }
    } catch(e){}
    if (!persisted){
      const idx = MEMORY.rates.findIndex(r => r.base===rate.base && r.quote===rate.quote);
      if (idx >= 0) MEMORY.rates[idx] = rate; else MEMORY.rates.push(rate);
    }
    return json(res, 200, { ok:true });
  }

  // ========== user.js ==========
  if (action === 'user') {
    const MAX_SKEW_MS = 120000;
    function sha256(str){ const crypto = require('crypto'); return crypto.createHash('sha256').update(str).digest('hex'); }
    let mongoCached = null;
    async function getMongo(){
      if (mongoCached) return mongoCached;
      const uri = process.env.MONGODB_URI;
      if (!uri) return null;
      try {
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const db = client.db(process.env.MONGODB_DB || 'usdt_trading');
        mongoCached = { client, db };
        return mongoCached;
      } catch (e) {
        return null;
      }
    }
    function json(res, status, data){ res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); }
    async function bufferToString(req){ return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => raw += c); req.on('end', () => resolve(raw)); req.on('error', reject); }); }
    const MEMORY = require('../../lib/inmemory');
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    try {
      const bodyStr = await bufferToString(req);
      let payload;
      try { payload = JSON.parse(bodyStr); } catch (e) { return json(res, 400, { error: 'invalid_json' }); }
      const { ts, user } = payload || {};
      if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return json(res, 400, { error: 'timestamp_skew' });
      const secret = process.env.SYNC_SECRET || '';
      const signature = req.headers['x-sync-signature'] || '';
      const expected = sha256(bodyStr + '|' + secret);
      if (!secret || signature !== expected) return json(res, 403, { error: 'bad_signature' });
      if (!user || !user.username) return json(res, 400, { error: 'invalid_user' });
      user.syncedAt = Date.now();
      let persisted = false;
      try {
        const mg = await getMongo();
        if (mg && mg.db) {
          const col = mg.db.collection('synced_users');
          let writeError = null;
          try {
            const result = await col.updateOne(
              { username: user.username },
              { $set: user },
              { upsert: true }
            );
            const acknowledged = !!(result && result.acknowledged);
            if (acknowledged) {
              persisted = true;
            }
          } catch (e) {
            writeError = e;
          }
          if (!persisted && writeError) {
            try {
              await new Promise(r => setTimeout(r, 200));
              const retryResult = await col.updateOne(
                { username: user.username },
                { $set: user },
                { upsert: true }
              );
              const ack2 = !!(retryResult && retryResult.acknowledged);
              if (ack2) {
                persisted = true;
                writeError = null;
              }
            } catch (e2) {}
          }
        }
      } catch (e) {}
      if (!persisted) {
        try {
          MEMORY.addOrUpdateUser(user);
        } catch (memErr) {}
      }
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { error: 'internal_server_error' });
    }
  }

  // 未知 action
  res.status(400).json({ error: 'Unknown action' });
}
