const { getFirestore } = require('../../lib/firestore');

module.exports = async (req, res) => {
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
    console.error('[admin/users] error', e && (e.stack || e.message));
    return res.status(500).json({ ok: false, error: 'internal' });
  }
};
