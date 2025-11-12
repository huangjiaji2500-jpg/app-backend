// /api/sync/user
// Upsert a user meta document (no sensitive fields)

const MAX_SKEW_MS = 120000;
function sha256(str){ const crypto = require('crypto'); return crypto.createHash('sha256').update(str).digest('hex'); }
let mongoCached = null;
async function getMongo(){
  console.log('SYNC DEBUG: getMongo() function called');
  
  if (mongoCached) {
    console.log('SYNC DEBUG: Returning cached mongo connection');
    return mongoCached;
  }
  
  const uri = process.env.MONGODB_URI;
  console.log('SYNC DEBUG: MONGODB_URI exists: ', uri ? 'YES' : 'NO');
  console.log('SYNC DEBUG: MONGODB_URI length: ', uri ? uri.length : 0);
  
  if (!uri) {
    console.log('SYNC DEBUG: MONGODB_URI not found, returning null');
    return null;
  }
  
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('SYNC DEBUG: Attempting to connect to MongoDB');
    
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'usdt_trading');
    mongoCached = { client, db };
    
    console.log('SYNC DEBUG: Successfully connected to MongoDB');
    console.log('SYNC DEBUG: Database name:', process.env.MONGODB_DB || 'usdt_trading');
    return mongoCached;
    
  } catch (e) {
    console.error('SYNC DEBUG: Mongo connection failed:', e && e.message ? e.message : e);
    console.error('SYNC DEBUG: Error stack:', e && e.stack ? e.stack.substring(0, 200) : 'No stack');
    return null;
  }
}

function json(res, status, data){ 
  res.statusCode = status; 
  res.setHeader('Content-Type', 'application/json'); 
  res.end(JSON.stringify(data)); 
}

async function bufferToString(req){ 
  return new Promise((resolve, reject) => { 
    let raw = ''; 
    req.on('data', c => raw += c); 
    req.on('end', () => resolve(raw)); 
    req.on('error', reject); 
  }); 
}

// Shared in-memory fallback (module-scoped shared instance)
const MEMORY = require('../../lib/inmemory');

module.exports = async (req, res) => {
  console.log('SYNC DEBUG: API request received:', req.method, req.url);

  if (req.method !== 'POST') {
    console.log('SYNC DEBUG: Method not allowed:', req.method);
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const bodyStr = await bufferToString(req);
    console.log('SYNC DEBUG: Request body received, length:', bodyStr.length);

    let payload; 
    try { 
      payload = JSON.parse(bodyStr); 
      console.log('SYNC DEBUG: Payload parsed successfully');
    } catch (e) { 
      console.error('SYNC DEBUG: Invalid JSON:', e.message);
      return json(res, 400, { error: 'invalid_json' }); 
    }

    const { ts, user } = payload || {};
    console.log('SYNC DEBUG: Payload contains ts:', !!ts, 'user:', !!user);

    if (!ts || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) {
      console.log('SYNC DEBUG: Timestamp invalid or skew too large');
      console.log('SYNC DEBUG: Current time:', Date.now(), 'Payload ts:', ts);
      return json(res, 400, { error: 'timestamp_skew' });
    }

    const secret = process.env.SYNC_SECRET || '';
    const signature = req.headers['x-sync-signature'] || '';
    const expected = sha256(bodyStr + '|' + secret);

    console.log('SYNC DEBUG: Signature validation - secret exists:', !!secret);
    console.log('SYNC DEBUG: Signature validation - signature provided:', !!signature);

    if (!secret || signature !== expected) {
      console.error('SYNC DEBUG: Bad signature - incoming:', signature.substring(0, 12) + '...');
      console.error('SYNC DEBUG: Bad signature - expected:', expected.substring(0, 12) + '...');
      return json(res, 403, { error: 'bad_signature' });
    }

    if (!user || !user.username) {
      console.error('SYNC DEBUG: Invalid user data:', user);
      return json(res, 400, { error: 'invalid_user' });
    }

    console.log('SYNC DEBUG: User data valid, username:', user.username);
    user.syncedAt = Date.now();
    let persisted = false;

    try {
      console.log('SYNC DEBUG: Attempting to persist user data');
      const mg = await getMongo();

      if (mg && mg.db) {
        console.log('SYNC DEBUG: MongoDB connection available, attempting to save user');

        const col = mg.db.collection('synced_users');
        let writeError = null;
        try {
          const result = await col.updateOne(
            { username: user.username },
            { $set: user },
            { upsert: true }
          );

          // More strict check for success
          const acknowledged = !!(result && result.acknowledged);
          const modified = result && (result.modifiedCount || 0);
          const upsertedId = result && result.upsertedId ? result.upsertedId._id || result.upsertedId : null;

          console.log('SYNC DEBUG: MongoDB updateOne result', {
            acknowledged,
            matchedCount: result.matchedCount,
            modifiedCount: modified,
            upsertedId
          });

          if (acknowledged) {
            persisted = true;
            console.log('SYNC DEBUG: User persisted to MongoDB (acknowledged=true)');
          } else {
            // Unexpected: no acknowledgement — treat as not persisted
            persisted = false;
            writeError = new Error('Mongo updateOne not acknowledged');
            console.error('SYNC DEBUG: MongoDB update not acknowledged');
          }

        } catch (e) {
          writeError = e;
          console.error('SYNC DEBUG: Write to MongoDB failed:', e && e.message ? e.message : e);
        }

        // lightweight retry for transient failures
        if (!persisted && writeError) {
          try {
            console.log('SYNC DEBUG: Attempting one retry for MongoDB write');
            // small delay
            await new Promise(r => setTimeout(r, 200));
            const retryResult = await col.updateOne(
              { username: user.username },
              { $set: user },
              { upsert: true }
            );
            const ack2 = !!(retryResult && retryResult.acknowledged);
            console.log('SYNC DEBUG: Retry result', { acknowledged: ack2, matchedCount: retryResult.matchedCount, modifiedCount: retryResult.modifiedCount });
            if (ack2) {
              persisted = true;
              console.log('SYNC DEBUG: Retry write succeeded, persisted=true');
              writeError = null;
            }
          } catch (e2) {
            console.error('SYNC DEBUG: Retry write failed:', e2 && e2.message ? e2.message : e2);
          }
        }

        if (!persisted && writeError) {
          // preserve error details in logs for easier debugging
          try {
            console.error('SYNC DEBUG: Final write error -- message:', writeError.message);
            if (writeError.code) console.error('SYNC DEBUG: Final write error code:', writeError.code);
          } catch (logErr) {
            console.error('SYNC DEBUG: Error while logging writeError:', logErr && logErr.message ? logErr.message : logErr);
          }
        }

      } else {
        console.log('SYNC DEBUG: MongoDB connection not available');
      }

    } catch (e) {
      console.error('SYNC DEBUG: Unexpected error in persistence block:', e && e.message ? e.message : e);
      console.error('SYNC DEBUG: Unexpected error stack:', e && e.stack ? e.stack.substring(0, 300) : 'no stack');
    }

    if (!persisted) {
      console.log('SYNC DEBUG: Falling back to shared in-memory storage');
      try {
        const action = MEMORY.addOrUpdateUser(user);
        console.log('SYNC DEBUG: In-memory fallback action:', action, 'username:', user.username);
      } catch (memErr) {
        console.error('SYNC DEBUG: Error writing to in-memory fallback:', memErr && memErr.message ? memErr.message : memErr);
      }
    }

    console.log('SYNC DEBUG: Request processing completed successfully');
    return json(res, 200, { ok: true });

  } catch (e) {
    console.error('SYNC DEBUG: Unexpected error in request processing:', e.message);
    console.error('SYNC DEBUG: Error stack:', e.stack.substring(0, 300));
    return json(res, 500, { error: 'internal_server_error' });
  }
};
