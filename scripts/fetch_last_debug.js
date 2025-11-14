const fs = require('fs');
const path = require('path');
const { getFirestore } = require('../lib/firestore');

// Try to load local .vercel.env if present so the script can authenticate the same way the deployment does.
try {
  const envPath = path.resolve(__dirname, '..', '.vercel.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
  }
} catch (e) {
  console.warn('Could not load .vercel.env locally:', e && e.message);
}

async function run(){
  const db = getFirestore();
  if (!db) {
    console.error('No firestore available (FIREBASE_SERVICE_ACCOUNT env missing or invalid)');
    process.exit(2);
  }
  try {
    const doc = await db.doc('platform/last_admin_post_debug').get();
    if (!doc.exists) {
      console.log('No debug doc found');
      return;
    }
    console.log('debug doc:', JSON.stringify(doc.data(), null, 2));
  } catch (e) {
    console.error('read error', e && (e.stack || e.message));
  }
}

run();
