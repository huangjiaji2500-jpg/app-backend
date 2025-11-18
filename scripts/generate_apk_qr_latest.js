const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// 最新 APK 链接（本次构建产物）
const apkUrl = 'https://expo.dev/artifacts/eas/cC4xg9DWsqRdfFdCP4Ue5p.apk';
const outDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'apk_qr_latest.png');

QRCode.toFile(outFile, apkUrl, {
  type: 'png',
  width: 512,
  margin: 1,
}, function (err) {
  if (err) {
    console.error('Failed to generate QR:', err);
    process.exit(1);
  }
  console.log('QR generated at', outFile);
});
