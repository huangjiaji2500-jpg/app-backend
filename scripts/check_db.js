const { MongoClient } = require('mongodb');
(async ()=>{
  const uri = process.env.MONGODB_URI || 'mongodb://app_sync_tester:jiaji250@cluster0-shard-00-00.wklrwgi.mongodb.net:27017,cluster0-shard-00-01.wklrwgi.mongodb.net:27017,cluster0-shard-00-02.wklrwgi.mongodb.net:27017/usdt_trading?ssl=true&replicaSet=atlas-wklrwgi-shard-0&authSource=admin&retryWrites=true&w=majority';
  console.log('Using URI startsWith:', uri.slice(0,40));
  // Do not pass legacy options; let the driver parse the connection string
  const client = new MongoClient(uri);
  try{
    await client.connect();
    const db = client.db('usdt_trading');
    const rates = await db.collection('synced_rates').find({}).toArray();
    const platform = await db.collection('synced_platform_config').find({}).toArray();
    console.log('synced_rates:', JSON.stringify(rates, null, 2));
    console.log('synced_platform_config:', JSON.stringify(platform, null, 2));
  }catch(e){ console.error('ERROR', e.message); }
  finally{ await client.close(); }
})();
