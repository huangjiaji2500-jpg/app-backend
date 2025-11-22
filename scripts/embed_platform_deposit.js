const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://app-tau-gilt-23.vercel.app/api/public/platform-config';
console.log('Fetching', url);
https.get(url, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      const pd = j.platformDeposit || {};
      const address = pd.address || '';
      const qr = pd.qrImage || '';
      if (!qr) {
        console.error('No qrImage found in response');
        process.exit(2);
      }

      const outPath = path.join(__dirname, '..', 'src', 'services', 'platformDeposit.js');
      const content = `import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { isCurrentUserAdmin } from './auth';\nimport { queuePlatformDepositSync } from './remoteSync';\n\nconst KEY_PLATFORM_DEPOSIT = 'PLATFORM_DEPOSIT_CONFIG';\n\n// Bundled default platform deposit (address + qrImage) to show in shipped app.\n// NOTE: This will be overridden by remote sync when clients fetch newer platformDeposit from server.\nconst BUNDLED_PLATFORM_DEPOSIT = {\n  address: ${JSON.stringify(address)},\n  qrImage: ${JSON.stringify(qr)}\n};\n\n// Shape: { address: string, qrImage: string(base64), note: string, updatedAt: number }\nexport async function getPlatformDepositAddress() {\n  try {\n    const raw = await AsyncStorage.getItem(KEY_PLATFORM_DEPOSIT);\n    if (!raw) return { address: BUNDLED_PLATFORM_DEPOSIT.address, qrImage: BUNDLED_PLATFORM_DEPOSIT.qrImage, note: '', updatedAt: null };\n    return JSON.parse(raw);\n  } catch {\n    return { address: BUNDLED_PLATFORM_DEPOSIT.address, qrImage: BUNDLED_PLATFORM_DEPOSIT.qrImage, note: '', updatedAt: null };\n  }\n}\n\nexport async function savePlatformDepositAddress({ address, qrImage, note }) {\n  const isAdmin = await isCurrentUserAdmin();\n  if (!isAdmin) throw new Error('not_admin');\n  const payload = { address: address || '', qrImage: qrImage || '', note: note || '', updatedAt: Date.now() };\n  await AsyncStorage.setItem(KEY_PLATFORM_DEPOSIT, JSON.stringify(payload));\n  try { await queuePlatformDepositSync(payload); } catch {}\n  return payload;\n}\n`;

      fs.writeFileSync(outPath, content, 'utf8');
      console.log('Wrote', outPath);
    } catch (e) {
      console.error('parse error', e && e.message);
      process.exit(3);
    }
  });
}).on('error', e => { console.error('fetch err', e && e.message); process.exit(1); });
