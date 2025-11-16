const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// 用户名校验：4-20位，字母数字下划线
const USERNAME_REGEX = /^[A-Za-z0-9_]{4,20}$/;

// 实时检查用户名是否占用
router.get('/check-username', [
  query('username').exists().withMessage('username required'),
], async (req, res) => {
  const { username } = req.query;
  if (!USERNAME_REGEX.test(username)) {
    return res.json({ available: false, reason: '用户名格式不正确' });
  }
  const existing = await User.findOne({ username });
  return res.json({ available: !existing });
});

// Firebase 注册后，创建用户文档并颁发后端JWT
router.post('/register-firebase', [
  body('username').custom(v => USERNAME_REGEX.test(v)).withMessage('用户名格式不正确'),
  body('firebaseUid').isString().notEmpty(),
  body('inviteCode').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, firebaseUid, inviteCode } = req.body;
  try {
    const used = await User.findOne({ username });
    if (used) return res.status(409).json({ error: '用户名已被占用' });

    let user = await User.findOne({ firebaseUid });
    if (user) return res.status(409).json({ error: '该帐号已注册' });

    user = new User({ username, firebaseUid });
    user.inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();

    if (inviteCode) {
      const inviter = await User.findOne({ inviteCode });
      if (inviter) {
        user.team = user.team || {};
        user.team.inviter = inviter._id;
        inviter.team = inviter.team || {};
        inviter.team.level1 = inviter.team.level1 || [];
        inviter.team.level1.push(user._id);
        await inviter.save();
      }
    }

    await user.save();

    // 同步写入 Firestore（如已配置），以便新注册用户在 Firestore 控制台可见
    try {
      const { getFirestore } = require('../../lib/firestore');
      const firestore = getFirestore();
      if (firestore) {
        const docRef = firestore.collection('users').doc(String(user._id));
        const payload = {
          username: user.username,
          firebaseUid: user.firebaseUid || null,
          inviteCode: user.inviteCode || null,
          registeredAt: user.registeredAt || new Date().toISOString(),
          createdAt: new Date().toISOString(),
          _id: String(user._id)
        };
        // if caller provided deviceId in registration, include it
        if (req.body && req.body.deviceId) {
          payload.deviceIds = Array.isArray(req.body.deviceId) ? req.body.deviceId : [String(req.body.deviceId)];
        }
        await docRef.set(payload, { merge: true });
      }
    } catch (e) {
      console.error('[auth] firestore write failed', e && e.message);
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user._id, username: user.username, inviteCode: user.inviteCode } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '注册失败' });
  }
});

// Firebase 登录：凭 firebaseUid 获取后端JWT
router.post('/login-firebase', [
  body('firebaseUid').isString().notEmpty(),
], async (req, res) => {
    const { firebaseUid } = req.body;
    try {
      const user = await User.findOne({ firebaseUid });
      if (!user) return res.status(404).json({ error: '用户不存在' });
      // update last login and record deviceId if present
      try {
        const now = new Date();
        user.updatedAt = now;
        user.lastLoginAt = now;
        if (req.body && req.body.deviceId) {
          const d = String(req.body.deviceId);
          // maintain a devices array (unique)
          user.devices = Array.isArray(user.devices) ? user.devices : (user.devices || []);
          if (!user.devices.includes(d)) user.devices.push(d);
        }
        await user.save();
        // sync to Firestore if available
        try {
          const { getFirestore } = require('../../lib/firestore');
          const firestore = getFirestore();
          if (firestore) {
            const docRef = firestore.collection('users').doc(String(user._id));
            const payload = { lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : new Date().toISOString() };
            if (user.devices) payload.deviceIds = Array.isArray(user.devices) ? user.devices : [];
            await docRef.set(payload, { merge: true });
          }
        } catch (e) { console.error('[auth] login firestore sync failed', e && e.message); }
      } catch (e) {
        console.warn('[auth] update lastLogin failed', e && e.message);
      }

      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      res.json({ token, user: { id: user._id, username: user.username, inviteCode: user.inviteCode } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: '登录失败' });
    }
});

// 临时密码登录（管理员生成的临时密码）：接受 { username, password }
// 验证用户文档中的 tempPasswordHash（格式：salt$derivedHex）
router.post('/login-temp', [
  body('username').isString().notEmpty(),
  body('password').isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: '用户不存在' });

    // 支持 tempPasswordHash 存在于文档中（由 admin API 写入 Mongo 的字段名为 tempPasswordHash）
    const stored = user.tempPasswordHash || user.tempPassword || null;
    if (!stored || typeof stored !== 'string' || !stored.includes('$')) {
      return res.status(400).json({ error: '用户无临时密码可用' });
    }

    try {
      const crypto = require('crypto');
      const [salt, derivedHex] = String(stored).split('$');
      const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
      if (candidate !== derivedHex) return res.status(401).json({ error: '密码不匹配' });
    } catch (e) {
      console.error('[auth][login-temp] crypto error', e && e.message);
      return res.status(500).json({ error: '服务器不支持临时密码验证' });
    }

    // 临时密码验证通过：更新登录时间并返回 JWT（保留 mustChangePassword 供前端强制修改）
    // 临时密码使用一次后：移除 tempPasswordHash，记录使用时间，并同步到 Firestore/Mongo
    try {
      const now = new Date();
      user.updatedAt = now;
      user.lastLoginAt = now;
      user.tempPasswordLastUsedAt = now;
      // remove the stored temp password so it cannot be reused
      try { delete user.tempPasswordHash; } catch (e) { user.tempPasswordHash = undefined; }
      if (req.body && req.body.deviceId) {
        const d = String(req.body.deviceId);
        user.devices = Array.isArray(user.devices) ? user.devices : (user.devices || []);
        if (!user.devices.includes(d)) user.devices.push(d);
      }
      if (typeof user.save === 'function') await user.save();

      // sync to Firestore if available
      try {
        const { getFirestore } = require('../../lib/firestore');
        const firestore = getFirestore();
        if (firestore) {
          const docRef = firestore.collection('users').doc(String(user._id));
          const payload = {
            tempPasswordHash: null,
            tempPasswordLastUsedAt: user.tempPasswordLastUsedAt ? user.tempPasswordLastUsedAt.toISOString() : new Date().toISOString(),
            lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : new Date().toISOString()
          };
          await docRef.set(payload, { merge: true });
        }
      } catch (e) { console.warn('[auth] login-temp firestore sync failed', e && e.message); }

      // best-effort raw Mongo sync (if configured)
      try {
        const uri = process.env.MONGODB_URI;
        if (uri) {
          const { MongoClient, ObjectId } = require('mongodb');
          const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
          await client.connect();
          const dbName = process.env.MONGODB_DB || 'usdt_trading';
          const mdb = client.db(dbName);
          const col = mdb.collection('users');
          const filter = {};
          if (/^[0-9a-fA-F]{24}$/.test(String(user._id))) {
            try { filter._id = new ObjectId(String(user._id)); } catch(e){ filter._id = String(user._id); }
          } else {
            filter._id = String(user._id);
          }
          const mongoUpdate = { $unset: {}, $set: {} };
          mongoUpdate.$unset.tempPasswordHash = '';
          mongoUpdate.$set.tempPasswordLastUsedAt = user.tempPasswordLastUsedAt ? user.tempPasswordLastUsedAt.toISOString() : new Date().toISOString();
          mongoUpdate.$set.lastLoginAt = user.lastLoginAt ? user.lastLoginAt.toISOString() : new Date().toISOString();
          await col.updateOne(filter, mongoUpdate, { upsert: false });
          await client.close();
        }
      } catch (e) { console.warn('[auth] login-temp mongo sync failed', e && (e.stack || e.message)); }

    } catch (e) {
      console.warn('[auth] update lastLogin failed', e && e.message);
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ token, user: { id: user._id, username: user.username, inviteCode: user.inviteCode }, mustChangePassword: !!user.mustChangePassword });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '登录失败' });
  }
});

module.exports = router;

// --------- 新增：支持通过临时密码登录后，使用返回的 JWT 完成密码修改（仅用于测试/迁移场景）
// POST /auth/change-temp-password  { newPassword }
// 需要 Authorization: Bearer <token>（token 来自 /login-temp）
router.post('/change-temp-password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { newPassword } = req.body || {};
    if (!newPassword || !/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(newPassword)) {
      return res.status(400).json({ error: 'invalid newPassword. must be >=6 chars, include letters and digits' });
    }
    // store a bcrypt hash locally so we can support local password login for testing
    const bcrypt = require('bcryptjs');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10) || 10;
    const hashed = await bcrypt.hash(newPassword, rounds);
    user.password = hashed;
    user.mustChangePassword = false;
    await user.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[auth] change-temp-password error', e && e.message);
    return res.status(401).json({ error: 'invalid token or request' });
  }
});

// POST /auth/login-local { username, password } - 支持使用本地存储的 bcrypt 密码进行登录（用于迁移/测试）
router.post('/login-local', [
  body('username').isString().notEmpty(),
  body('password').isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.password) return res.status(400).json({ error: '用户未设置本地密码' });
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '密码不匹配' });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ token, user: { id: user._id, username: user.username } });
  } catch (e) {
    console.error('[auth] login-local error', e && e.message);
    return res.status(500).json({ error: '登录失败' });
  }
});
