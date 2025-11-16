// Mobile/app login endpoint has been disabled.
// To fully remove this file, delete it from the repository; currently this stub
// returns 410 Gone so any mobile clients receive a clear signal that the
// endpoint is no longer available.

module.exports = async (req, res) => {
  res.status(410).json({ ok: false, error: 'mobile login endpoint removed' });
};
