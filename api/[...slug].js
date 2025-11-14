const { getFirestore } = require('../lib/firestore');

module.exports = async (req, res) => {
  // req.query.slug will be an array of path segments after /api/
  const slug = Array.isArray(req.query && req.query.slug) ? req.query.slug : (req.url && req.url.split('?')[0].split('/').slice(2)) || [];

  // Route: POST /api/auth/on-login
  if (slug[0] === 'auth' && slug[1] === 'on-login') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const idToken = (req.body && req.body.idToken) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!idToken) return res.status(400).json({ ok: false, error: 'idToken required' });
    try {
      const db = getFirestore();
      const admin = require('firebase-admin');
      if (!admin || !admin.auth) return res.status(500).json({ ok: false, error: 'firebase-admin not initialized' });
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const profile = {
        uid,
        email: decoded.email || null,
        displayName: decoded.name || decoded.picture || null,
        providers: decoded.firebase && decoded.firebase.sign_in_provider ? [decoded.firebase.sign_in_provider] : null,
        lastLoginAt: new Date().toISOString(),
      };
      if (!db) return res.status(500).json({ ok: false, error: 'firestore unavailable' });
      const userRef = db.doc(`users/${uid}`);
      const snap = await userRef.get();
      if (!snap.exists) profile.createdAt = new Date().toISOString();
      Object.keys(profile).forEach(k => profile[k] === undefined && (profile[k] = null));
      await userRef.set(profile, { merge: true });
      return res.status(200).json({ ok: true, uid });
    } catch (e) {
      console.error('[api][auth/on-login] error', e && (e.stack || e.message));
      return res.status(500).json({ ok: false, error: 'token verification failed' });
    }
  }

  // Route: GET /api/admin/users
  if (slug[0] === 'admin' && slug[1] === 'users') {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const headerSecret = (req.headers['x-admin-secret'] || '').toString();
    const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
    if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
    if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
      const q = await db.collection('users').orderBy('createdAt', 'desc').limit(200).get();
      const users = [];
      q.forEach(d => users.push({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok: true, count: users.length, users });
    } catch (e) {
      console.error('[api][admin/users] error', e && (e.stack || e.message));
      return res.status(500).json({ ok: false, error: 'internal' });
    }
  }

  return res.status(404).json({ ok: false, error: 'not-found' });
};
