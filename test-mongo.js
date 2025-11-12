const uri = process.argv[2];
if (!uri) { console.error('Usage: node test-mongo.js "<MONGODB_URI>"'); process.exit(1); }

(async () => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Trying to connect...');
    await client.connect();
    console.log('Connected OK, pinging...');
    const db = client.db(process.env.MONGODB_DB || 'usdt_trading');
    await db.command({ ping: 1 });
    console.log('Ping ok. DB:', db.databaseName);
    await client.close();
    process.exit(0);
  } catch (e) {
    console.error('Connect error:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
