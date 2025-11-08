const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Commission = require('../models/Commission');

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

// 获取团队统计与佣金
router.get('/stats', auth, async (req, res) => {
  const me = await User.findById(req.userId);
  if (!me) return res.status(404).json({ error: 'User not found' });

  const level1Members = me.team?.level1?.length || 0;
  // 级联统计：在生产环境建议使用聚合，这里简化
  const level2Members = me.team?.level2?.length || 0;
  const level3Members = me.team?.level3?.length || 0;
  const totalMembers = level1Members + level2Members + level3Members;

  const level1Commission = await Commission.aggregate([
    { $match: { user: me._id, level: 1 } },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);
  const level2Commission = await Commission.aggregate([
    { $match: { user: me._id, level: 2 } },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);
  const level3Commission = await Commission.aggregate([
    { $match: { user: me._id, level: 3 } },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);

  const l1 = level1Commission[0]?.amount || 0;
  const l2 = level2Commission[0]?.amount || 0;
  const l3 = level3Commission[0]?.amount || 0;
  const totalCommission = l1 + l2 + l3;

  res.json({
    totalMembers,
    level1Members,
    level2Members,
    level3Members,
    totalCommission,
    level1Commission: l1,
    level2Commission: l2,
    level3Commission: l3,
  });
});

module.exports = router;