#!/usr/bin/env node
const { MongoClient } = require('mongodb');

function maskUri(uri){
  try{
    // attempt to hide password in URI
    return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/, (m,p,user,pass)=> `${p}${user}:****@`);
  }catch(e){ return uri; }
}

const uri = process.argv[2] || process.env.MONGODB_URI;
if(!uri){
  console.error('Usage: node scripts/test-mongo.js "<MONGODB_URI>"\nOr set environment variable MONGODB_URI and run without args.');
  process.exit(2);
}

(async ()=>{
  const out = { ok: false, uri_present: !!uri, masked: maskUri(uri) };
  let client;
  try{
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    // ping
    const admin = client.db().admin ? client.db().admin() : client.db().admin;
    try{
      // try ping via runCommand for broad compatibility
      await client.db().command({ ping: 1 });
    }catch(e){ /* ignore ping inner error */ }
    // list databases (read-only) to surface auth errors vs DNS errors
    const dbs = await client.db().admin().listDatabases();
    out.ok = true;
    out.dbCount = Array.isArray(dbs.databases) ? dbs.databases.length : null;
    out.sampleDb = (dbs.databases && dbs.databases[0] && dbs.databases[0].name) || null;
    console.log(JSON.stringify(out, null, 2));
    await client.close();
    process.exit(0);
  }catch(err){
    out.error = err && err.message ? err.message : String(err);
    out.name = err && err.name ? err.name : undefined;
    // try to detect common causes
    if(out.error && out.error.toLowerCase().includes('authentication')) out.hint = 'Authentication failed — check username/password and URL-encoding of special characters.';
    if(out.error && out.error.toLowerCase().includes('getaddrinfo')) out.hint = 'DNS resolution failed — SRV host may not resolve from this network; try non-SRV connection string or check outbound DNS from host.';
    console.error(JSON.stringify(out, null, 2));
    if(client) try{ await client.close(); }catch(e){}
    process.exit(1);
  }
})();
