const { getFirestore } = require('../../lib/firestore');

module.exports = async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) return res.status(500).json({ ok: false, error: 'firestore not initialized' });
  const platformDocRef = db.doc('platform/platform');
  // fetch latest 10 debug history docs from platform_debug_history
  const [platformSnap, debugQuerySnap] = await Promise.all([
    platformDocRef.get(),
    db.collection('platform_debug_history').orderBy('ts', 'desc').limit(10).get(),
  ]);
  const debugEntries = [];
  debugQuerySnap.forEach(d => debugEntries.push({ id: d.id, ...d.data() }));
  return res.status(200).json({ ok: true, debugEntries, platform: platformSnap.exists ? platformSnap.data() : null });
  } catch (e) {
    console.error('[debug/last-admin-post] error', e && (e.stack || e.message));
    return res.status(500).json({ ok: false, error: 'internal' });
  }
};
