const mongoose = require('mongoose');

const CommissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 下级
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  level: { type: Number, enum: [1,2,3], required: true },
  rate: { type: Number, required: true }, // 0.30 / 0.15 / 0.05
  amount: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Commission', CommissionSchema);
