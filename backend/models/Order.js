const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  amountUSDT: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalCNY: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending_payment', 'pending_confirm', 'completed', 'dispute', 'cancelled'], 
    default: 'pending_payment' 
  },
  paymentMethod: { type: String },
  receiptAddress: { type: String },
  transactionHash: { type: String },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
