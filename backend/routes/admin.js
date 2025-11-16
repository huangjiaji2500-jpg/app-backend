const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 管理端点：受 x-admin-secret 保护，用于重置用户临时密码等管理操作
router.patch('/users', async (req, res) => {
  const headerSecret = (req.headers['x-admin-secret'] || '').toString();
  const envSecret = process.env.ADMIN_PANEL_SECRET || process.env.SYNC_SECRET;
  if (!envSecret) return res.status(500).json({ ok: false, error: 'Server misconfiguration: ADMIN_PANEL_SECRET not set' });
  if (!headerSecret || headerSecret !== envSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  try {
    const body = req.body || {};
    const targetId = body.id || body.userId || body.username;
    if (!targetId) return res.status(400).json({ ok: false, error: 'id or username required' });

    let user;
    if (body.username || (!/^[0-9a-fA-F]{24}$/.test(String(targetId)) && typeof targetId === 'string')) {
      user = await User.findOne({ username: String(targetId) });
    }
    if (!user) {
      try { user = await User.findById(String(targetId)); } catch (e) { /* ignore */ }
    }
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    const dbUpdate = {};
    const respUpdate = {};
    if (body.role) { dbUpdate.role = body.role; respUpdate.role = body.role; }
    if (typeof body.disabled !== 'undefined') { dbUpdate.disabled = !!body.disabled; respUpdate.disabled = !!body.disabled; }

    if (body.resetPassword === true || body.action === 'resetPassword') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      let temp = '';
      for (let i=0;i<8;i++) temp += chars[Math.floor(Math.random()*chars.length)];
      const crypto = require('crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const derivedKey = crypto.scryptSync(temp, salt, 64).toString('hex');
      const storedHash = `${salt}$${derivedKey}`;
      dbUpdate.mustChangePassword = true;
      dbUpdate.tempPasswordHash = storedHash;
      respUpdate.mustChangePassword = true;
      respUpdate.tempPassword = temp;
      // apply to user object
      user.mustChangePassword = true;
      user.tempPasswordHash = storedHash;
    }

    // apply other dbUpdate fields
    for (const k of Object.keys(dbUpdate)) user[k] = dbUpdate[k];
    await user.save();

    return res.status(200).json({ ok: true, id: user._id, update: respUpdate });
  } catch (e) {
    console.error('[api/admin/users] error', e && (e.stack || e.message));
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

module.exports = router;
