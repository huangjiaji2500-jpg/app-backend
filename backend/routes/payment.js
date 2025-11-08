const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 提现
router.post('/withdraw', auth, async (req, res) => {
  const { amount, toWalletAddress } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.withdrawable < amount) return res.status(400).json({ error: 'Insufficient withdrawable' });

  // 这里应调用链上或托管支付服务；演示中直接扣减
  user.withdrawable -= amount;
  await user.save();

  res.json({ success: true, withdrawable: user.withdrawable });
});

module.exports = router;