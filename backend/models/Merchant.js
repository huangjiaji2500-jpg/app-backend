const mongoose = require('mongoose');

const MerchantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rating: { type: Number, default: 0 },
  returnAmount: { type: Number, default: 0 },
  orderLimitMin: { type: Number, default: 0 },
  orderLimitMax: { type: Number, default: 0 },
  settlementTimeMin: { type: Number, default: 0 }, // 分钟
  settlementTimeMax: { type: Number, default: 0 },
  unitPrice: { type: Number, required: true },
  transactions: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Merchant', MerchantSchema);
