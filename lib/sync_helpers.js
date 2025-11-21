const crypto = require('crypto');
const adminLib = require('firebase-admin');

function initFirebase() {
  if (adminLib.apps && adminLib.apps.length) return adminLib.app();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  const json = Buffer.from(b64, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(json);
  return adminLib.initializeApp({ credential: adminLib.credential.cert(serviceAccount) });
}

function jsonResponse(res, statusCode, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Signature, X-Ts');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.statusCode = statusCode;
  res.end(JSON.stringify(body));
}

function hashHex(input){
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

async function verifyPostSignature(req, payload) {
  const header = req.headers && (req.headers['x-sync-signature'] || req.headers['X-Sync-Signature']);
  const secret = process.env.SYNC_SECRET || '';
  if (!secret) return { ok:false, err:'sync_secret_not_configured' };
  if (!header) return { ok:false, err:'missing_signature' };
  const base = `${JSON.stringify(payload)}|${secret}`;
  const expected = hashHex(base);
  if (expected !== String(header)) return { ok:false, err:'bad_signature' };
  return { ok:true };
}

function verifyGetSignature(req){
  const header = req.headers && (req.headers['x-sync-signature'] || req.headers['X-Sync-Signature']);
  const ts = req.headers && (req.headers['x-ts'] || req.headers['X-Ts']);
  const secret = process.env.SYNC_SECRET || '';
  if (!secret) return { ok:false, err:'sync_secret_not_configured' };
  if (!header || !ts) return { ok:false, err:'missing_signature_or_ts' };
  const now = Date.now();
  const tnum = Number(ts) || 0;
  if (Math.abs(now - tnum) > 10 * 60 * 1000) return { ok:false, err:'ts_out_of_range' };
  const expected = hashHex(`${ts}|${secret}`);
  if (expected !== String(header)) return { ok:false, err:'bad_signature' };
  return { ok:true };
}

module.exports = {
  initFirebase,
  jsonResponse,
  verifyPostSignature,
  verifyGetSignature,
};
