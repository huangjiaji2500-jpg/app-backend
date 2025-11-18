const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const apkUrl = 'https://expo.dev/artifacts/eas/cFRBag2jZ3MzpPPxtZz1ei.apk';
const outDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'apk_qr_config_latest.png');
QRCode.toFile(outFile, apkUrl, { type: 'png', width: 512, margin: 1 }, function (err) {
  if (err) { console.error('Failed to generate QR:', err); process.exit(1); }
  console.log('QR generated at', outFile);
});
