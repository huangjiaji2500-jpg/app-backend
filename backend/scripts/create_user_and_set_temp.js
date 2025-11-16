// usage: node create_user_and_set_temp.js <username>
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const crypto = require('crypto');

async function main(){
  const username = process.argv[2] || 'jiaji250';
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/usdt_trading';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', uri);
  let user = await User.findOne({ username });
  if (!user) {
    user = new User({ username, firebaseUid: `local_seed_${username}` });
    await user.save();
    console.log('Created user', username, 'id=', user._id);
  } else {
    console.log('Found user', username, 'id=', user._id);
  }
  // generate temp
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let temp = '';
  for (let i=0;i<8;i++) temp += chars[Math.floor(Math.random()*chars.length)];
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(temp, salt, 64).toString('hex');
  const stored = `${salt}$${derived}`;
  user.tempPasswordHash = stored;
  user.mustChangePassword = true;
  await user.save();
  console.log('Temporary password for', username, 'is:', temp);
  await mongoose.disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
