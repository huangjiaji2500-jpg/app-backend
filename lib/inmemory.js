// Shared in-memory fallback store (not persistent)
// NOTE: This is only safe as a short-lived, same-process cache.
// In serverless environments this cannot be relied on for persistence.

module.exports = {
  orders: [],
  deposits: [],
  users: [],
  rates: [],
  paymentMethods: [],
  platformDeposit: null,

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
