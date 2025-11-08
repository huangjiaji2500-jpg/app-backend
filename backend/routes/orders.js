const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
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

// 创建订单
router.post('/', auth, async (req, res) => {
  const { merchantId, amountUSDT, unitPrice, totalCNY, paymentMethod, receiptAddress } = req.body;
  try {
    const order = await Order.create({
      user: req.userId,
      merchant: merchantId,
      amountUSDT,
      unitPrice,
      totalCNY,
      paymentMethod,
      receiptAddress,
    });
    res.json(order);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Create order failed' });
  }
});

// 查询订单（按状态）
router.get('/', auth, async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = { user: req.userId };
  if (status) query.status = status;

  const items = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  const total = await Order.countDocuments(query);
  res.json({ items, total, hasMore: page * limit < total });
});

// 更新订单状态（触发返佣）
router.patch('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  try {
    const order = await Order.findById(req.params.id).populate('user');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    await order.save();

    // 如果完成订单，触发返佣
    if (status === 'completed') {
      const user = await User.findById(order.user._id).populate('team.inviter');
      const amount = order.amountUSDT * order.unitPrice; // 佣金基数：法币金额

      const levelRates = [
        parseFloat(process.env.DEFAULT_COMMISSION_LEVEL1 || '0.30'),
        parseFloat(process.env.DEFAULT_COMMISSION_LEVEL2 || '0.15'),
        parseFloat(process.env.DEFAULT_COMMISSION_LEVEL3 || '0.05'),
      ];

      let currentInviter = user.team?.inviter || null;
      for (let i = 0; i < 3 && currentInviter; i++) {
        const rate = levelRates[i];
        const commissionAmount = amount * rate;
        await Commission.create({
          user: currentInviter,
          fromUser: user._id,
          order: order._id,
          level: i + 1,
          rate,
          amount: commissionAmount,
        });
        // 给邀请人加到可提现
        const inviterUser = await User.findById(currentInviter);
        inviterUser.totalEarnings += commissionAmount;
        inviterUser.withdrawable += commissionAmount;
        await inviterUser.save();

        // 递归上级
        const inviterOfInviter = inviterUser.team?.inviter || null;
        currentInviter = inviterOfInviter;
      }
    }

    res.json(order);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update order status failed' });
  }
});

module.exports = router;
