Place a QR image named `qrcode.png` here to serve it at `/uploads/qrcode.png`.

Recommended steps:
1. Generate a 512x512 PNG of the deposit address QR (e.g. using https://api.qrserver.com).
2. Save file as `public/uploads/qrcode.png` in this repository and commit + push.
3. After Vercel deploys, the image will be available at:
   `https://<YOUR_VERCEL_DOMAIN>/uploads/qrcode.png`

Notes:
- You can also use a data URL in platform config (field `qrImage`) like `data:image/png;base64,...`.
- If the image is large, consider hosting it on an object storage (S3) or other CDN and use its URL in `platformDeposit.qrImage`.