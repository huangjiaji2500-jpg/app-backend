const crypto = require('crypto');

// 生成 8 字符临时密码并返回 { temp, storedHash }
function generateTempAndHash() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let temp = '';
  for (let i = 0; i < 8; i++) temp += chars[Math.floor(Math.random() * chars.length)];
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(temp, salt, 64).toString('hex');
  const stored = `${salt}$${derived}`;
  return { temp, stored };
}

// 验证候选密码是否匹配 stored (salt$derivedHex)
function verifyTempPassword(stored, candidate) {
  if (!stored || typeof stored !== 'string') return false;
  if (!stored.includes('$')) return false;
  const [salt, derivedHex] = stored.split('$');
  const candidateDerived = crypto.scryptSync(candidate, salt, 64).toString('hex');
  return candidateDerived === derivedHex;
}

module.exports = { generateTempAndHash, verifyTempPassword };
