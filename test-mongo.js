const { MongoClient } = require('mongodb');
// 直接写死连接信息，不用环境变量，小白友好！
const uri = "mongodb://app_sync_tester:jiaji250@cluster0-shard-00-00.wklrwgi.mongodb.net:27017/?ssl=true&authSource=admin&retryWrites=true&directConnection=true";

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB连接成功！终于搞定啦~");
  } catch (err) {
    console.log("❌ 连接失败，错误信息：", err.message);
  } finally {
    await client.close();
  }
}
run();