// Shared in-memory fallback store (not persistent)
// NOTE: This is only safe as a short-lived, same-process cache.
// In serverless environments this cannot be relied on for persistence.

module.exports = {
  orders: [],
  deposits: [],
  users: [],
  rates: [],
  paymentMethods: [],
  // If no remote platformDeposit is configured, provide a sensible default
  // so clients (mobile/web) can show a usable deposit address and QR code.
  // NOTE: Update this to a real hosted image path if you prefer storing
  // the PNG in `public/uploads/qrcode.png` and deploying it with Vercel.
  platformDeposit: {
    note: '平台充值地址 (默认)',
    address: 'TAxVgpjRQeRBrH7oSY8KxkVJwNx82u5e8Y',
    // Use a stable public QR-generator that returns a PNG for the address.
    // Clients can `Image`-load this URL directly.
    qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=TAxVgpjRQeRBrH7oSY8KxkVJwNx82u5e8Y',
    updatedAt: Date.now()
  },

  // optional helpers
  addOrUpdateUser(user) {
    const idx = this.users.findIndex(u => u.username === user.username);
    if (idx >= 0) {
      this.users[idx] = user;
      return 'updated';
    }
    this.users.push(user);
    return 'added';
  },
  listUsers(limit = 200) {
    return this.users.slice(-limit);
  }
};
