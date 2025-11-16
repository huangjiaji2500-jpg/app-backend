const { getFirestore } = require('../lib/firestore');

module.exports = async (req, res) => {
  // req.query.slug will be an array of path segments after /api/
  const slug = Array.isArray(req.query && req.query.slug) ? req.query.slug : (req.url && req.url.split('?')[0].split('/').slice(2)) || [];

  // NOTE: Mobile app login endpoint removed. Previously handled POST /api/auth/on-login.
  // The mobile/app login handler `api/auth/on-login.js` has been deleted to keep only web admin.

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
