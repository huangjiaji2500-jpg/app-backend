const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// 认证中间件
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 获取个人信息
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user._id,
    email: user.email,
    balanceUSDT: user.balanceUSDT,
    totalEarnings: user.totalEarnings,
    withdrawable: user.withdrawable,
    wallets: user.wallets || [],
    inviteCode: user.inviteCode,
  });
});

// 添加收款地址
router.post('/wallets', auth, async (req, res) => {
  const { network, address, label } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newWallet = { network: network || 'TRC20', address, label, verified: false };
  user.wallets = user.wallets || [];
  user.wallets.push(newWallet);
  await user.save();
  res.json(user.wallets);
});

module.exports = router;