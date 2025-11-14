const { getFirestore } = require('../../lib/firestore');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const idToken = (req.body && req.body.idToken) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!idToken) return res.status(400).json({ ok: false, error: 'idToken required' });

  try {
    // Ensure firebase admin is initialized via lib/getFirestore
    const db = getFirestore();
    const admin = require('firebase-admin');
    if (!admin || !admin.auth) return res.status(500).json({ ok: false, error: 'firebase-admin not initialized' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // Build user profile fields
    const profile = {
      uid,
      email: decoded.email || null,
      displayName: decoded.name || decoded.picture || null,
      providers: decoded.firebase && decoded.firebase.sign_in_provider ? [decoded.firebase.sign_in_provider] : null,
      lastLoginAt: new Date().toISOString(),
    };

    // Upsert into Firestore users/{uid}
    if (!db) return res.status(500).json({ ok: false, error: 'firestore unavailable' });
    const userRef = db.doc(`users/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists) {
      profile.createdAt = new Date().toISOString();
    }
    // remove undefined values -> ensure nulls instead
    Object.keys(profile).forEach(k => profile[k] === undefined && (profile[k] = null));
    await userRef.set(profile, { merge: true });

    return res.status(200).json({ ok: true, uid });
  } catch (e) {
    console.error('[auth/on-login] error', e && (e.stack || e.message));
    return res.status(500).json({ ok: false, error: 'token verification failed' });
  }
};
