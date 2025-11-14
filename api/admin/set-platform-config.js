const admin = require('firebase-admin');

// Initialize Firebase from Base64 env or direct JSON env
let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  try {
    serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  } catch(e) { /* ignore and fallback */ }
}
if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch(e) { /* ignore */ }
}
if (serviceAccount && (!admin.apps || admin.apps.length === 0)) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = (admin.apps && admin.apps.length) ? admin.firestore() : null;

module.exports = async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const headerSecret = (req.headers['x-admin-secret'] || '').toString();
  const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
  if (!envSecret) {
    return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
  }
  if (!headerSecret || headerSecret !== envSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // parse body
  let body = req.body;
  let raw = undefined;
  // If body is missing, or not already an object (some runtimes give raw string),
  // try to parse req.rawBody or read the request stream.
  if (!body || typeof body !== 'object' || (typeof body === 'object' && Object.keys(body).length === 0)) {
    console.log('[admin/set-platform-config] headers:', Object.keys(req.headers || {}));
    console.log('[admin/set-platform-config] content-length:', req.headers && req.headers['content-length']);
    // Vercel may not populate req.body; try req.rawBody, else read the request stream
    raw = req.rawBody;
    if (!raw) {
      try {
        raw = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => { data += chunk.toString(); });
          req.on('end', () => resolve(data));
          req.on('error', err => reject(err));
        });
      } catch (e) {
        console.error('[admin/set-platform-config] error reading request stream', e && (e.stack || e.message));
        raw = '';
      }
    }
    try { body = raw ? JSON.parse(raw) : {}; } catch (e) { console.error('[admin/set-platform-config] JSON parse error', e && (e.stack || e.message)); body = {}; }
    console.log('[admin/set-platform-config] parsed body type:', typeof body, 'keys:', Object.keys(body || {}));
  }

  // We'll write a debug document after updating the platform doc so the platform write's success is primary.
  let lastDebugId = undefined;
  let lastDebugError = undefined;

  const { displayRates, platformDeposit } = body || {};
  if (!displayRates && !platformDeposit) {
    return res.status(400).json({ ok: false, error: 'Nothing to update (expect displayRates or platformDeposit)' });
  }

  // Ensure Firebase was initialized at module load time
  try {
    if (!db) return res.status(500).json({ ok: false, error: 'FIREBASE_SERVICE_ACCOUNT env missing or invalid' });
    const docRef = db.doc('platform/platform');
    // Use numeric timestamps for platformDeposit.updatedAt so mobile app (which stores
    // updatedAt as a number) can compare easily. Also maintain a configVersion counter
    // so clients can detect changes reliably.
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();
    const payload = { updatedAt: nowIso };
    if (displayRates) payload.displayRates = displayRates;
    if (platformDeposit) {
      // ensure platformDeposit has numeric updatedAt
      try {
        if (typeof platformDeposit === 'object') {
          platformDeposit.updatedAt = nowTs;
        }
      } catch (e) {}
      payload.platformDeposit = platformDeposit;
    }

    // read current doc to increment configVersion
    let currentVersion = 0;
    try {
      const snap = await docRef.get();
      if (snap && snap.exists) {
        const data = snap.data();
        if (data && typeof data.configVersion === 'number') currentVersion = data.configVersion;
      }
    } catch (e) {
      // ignore read errors and default to 0
      console.warn('[admin/set-platform-config] failed to read current configVersion', e && (e.stack || e.message));
    }
    payload.configVersion = (currentVersion || 0) + 1;

    await docRef.set(payload, { merge: true });

    // attempt to write debug history after the platform update only if DEBUG_ADMIN_POST env enabled
    try {
      const enableDebug = (process.env.DEBUG_ADMIN_POST || '').toString().toLowerCase() === 'true';
      if (enableDebug && db) {
        const debugDoc = {
          ts: new Date().toISOString(),
          headers: Object.keys(req.headers || {}).reduce((acc, k) => { acc[k] = req.headers[k]; return acc; }, {}),
          contentLength: req.headers && req.headers['content-length'] ? req.headers['content-length'] : null,
          raw: (typeof raw === 'string' && raw.length > 0) ? raw : null,
          parsedBody: (body && Object.keys(body || {}).length) ? body : null,
          platformUpdatedAt: now,
        };
        try {
          const ref = await db.collection('platform_debug_history').add(debugDoc);
          lastDebugId = ref.id;
        } catch (dbgErr) {
          lastDebugError = dbgErr && (dbgErr.stack || dbgErr.message);
          console.error('[admin/set-platform-config] failed to write debug doc', lastDebugError);
        }
      }
    } catch (e) {
      console.error('[admin/set-platform-config] unexpected error while writing debug doc', e && (e.stack || e.message));
    }

  const resp = { ok: true };
  if (lastDebugId) resp.debugId = lastDebugId;
  if (lastDebugError) resp.debugError = lastDebugError;
  return res.status(200).json(resp);
  } catch (err) {
    console.error('set-platform-config error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};