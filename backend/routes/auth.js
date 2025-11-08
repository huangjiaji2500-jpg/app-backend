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
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user._id, username: user.username, inviteCode: user.inviteCode } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '登录失败' });
  }
});

module.exports = router;
