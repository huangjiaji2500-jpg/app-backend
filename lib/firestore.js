// Lightweight Firestore initializer and helpers
// Exports: getFirestore() -> returns Firestore instance or null

let firestore = null;

function parseServiceAccount(envVal){
  if (!envVal) return null;
  try {
    // try base64 first
    const possible = Buffer.from(envVal, 'base64').toString('utf8');
    const parsed = JSON.parse(possible);
    if (parsed && parsed.project_id) return parsed;
  } catch(e){}
  try {
    const parsed = JSON.parse(envVal);
    if (parsed && parsed.project_id) return parsed;
  } catch(e){}
  return null;
}

module.exports.getFirestore = function getFirestore(){
  if (firestore) return firestore;
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  const sa = parseServiceAccount(saEnv);
  if (!sa) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    firestore = admin.firestore();
    // optional: set timestampsInSnapshots behavior is default in modern SDK
    return firestore;
  } catch(e) {
    console.log('[lib/firestore] init error', e && e.message);
    return null;
  }
};
