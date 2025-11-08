const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  network: { type: String, enum: ['TRC20', 'ERC20'], default: 'TRC20' },
  address: { type: String, required: true },
  label: { type: String },
  isDefault: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const TeamSchema = new mongoose.Schema({
  inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  level1: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  level2: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  level3: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const UserSchema = new mongoose.Schema({
  // 新增：用户名与 Firebase UID
  username: { type: String, unique: true, sparse: true },
  firebaseUid: { type: String, unique: true, sparse: true },
  phone: { type: String },
  email: { type: String, unique: true, sparse: true },
  // 密码由 Firebase 托管，本地不存储
  password: { type: String },
  nickname: { type: String },
  avatar: { type: String },
  role: { type: String, enum: ['user', 'merchant', 'admin'], default: 'user' },
  language: { type: String, enum: ['zh', 'en', 'ko', 'ja'], default: 'zh' },
  balanceUSDT: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  withdrawable: { type: Number, default: 0 },
  wallets: [WalletSchema],
  team: TeamSchema,
  inviteCode: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
