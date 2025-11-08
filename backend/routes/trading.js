const express = require('express');
const router = express.Router();
const Merchant = require('../models/Merchant');

// 获取商家列表（可筛选）
router.get('/merchants', async (req, res) => {
  const { minAmount, maxAmount } = req.query;

  let query = {};
  if (minAmount) query.orderLimitMin = { $lte: Number(minAmount) };
  if (maxAmount) query.orderLimitMax = { $gte: Number(maxAmount) };

  const merchants = await Merchant.find(query).sort({ unitPrice: -1 });
  res.json(merchants);
});

// 快捷匹配（简单策略：按最高单价且在线）
router.get('/quick-match', async (req, res) => {
  const { amount } = req.query;
  const m = await Merchant.findOne({ isOnline: true, orderLimitMin: { $lte: amount }, orderLimitMax: { $gte: amount } }).sort({ unitPrice: -1 });
  res.json(m || null);
});

module.exports = router;
