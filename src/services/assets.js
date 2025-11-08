import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUsername } from './auth';
import { getCommissions } from './team';

// Storage keys
const KEY_WALLET_INFO = 'WALLET_ADDRESS_INFO';
const KEY_LOCAL_ORDERS = 'LOCAL_ORDERS';
const KEY_USER_BALANCE_PREFIX = 'USER_BALANCE_';

// Wallet address helpers
export async function getWalletAddressInfo() {
  const raw = await AsyncStorage.getItem(KEY_WALLET_INFO);
  if (!raw) return { network: 'TRC20', address: '', label: '', status: 'not_submitted', updatedAt: null };
  try { return JSON.parse(raw); } catch { return { network: 'TRC20', address: '', label: '', status: 'not_submitted', updatedAt: null }; }
}

export async function saveWalletAddressInfo(info) {
  const current = await getWalletAddressInfo();
  const next = { ...current, ...info, updatedAt: Date.now() };
  await AsyncStorage.setItem(KEY_WALLET_INFO, JSON.stringify(next));
  return next;
}

export async function submitWalletAddress({ network = 'TRC20', address, label }) {
  const next = { network, address, label: label || '', status: 'pending_review', updatedAt: Date.now() };
  await AsyncStorage.setItem(KEY_WALLET_INFO, JSON.stringify(next));
  return next;
}

export async function approveWalletAddress() {
  const info = await getWalletAddressInfo();
  const next = { ...info, status: 'approved', updatedAt: Date.now() };
  await AsyncStorage.setItem(KEY_WALLET_INFO, JSON.stringify(next));
  return next;
}

// Assets snapshot composed from orders + commission + wallet status
export async function getAssetSnapshot() {
  const [wallet, ordersRaw, username, allCommissions] = await Promise.all([
    getWalletAddressInfo(),
    AsyncStorage.getItem(KEY_LOCAL_ORDERS),
    getCurrentUsername(),
    getCommissions(),
  ]);
  const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  const completed = orders.filter(o => o.status === 'completed');
  const balanceUSDT = completed.reduce((sum, o) => sum + (Number(o.amountUSDT) || 0), 0);
  const mine = (username && allCommissions) ? allCommissions.filter(c => c.toUsername === username) : [];
  const commissionTotalUSDT = mine.reduce((s, c) => s + (Number(c.amountUSDT) || 0), 0);
  // 新增：充值后的可用余额（管理员审核入账）
  let topupBalance = 0;
  try {
    if (username) {
      const raw = await AsyncStorage.getItem(KEY_USER_BALANCE_PREFIX + username);
      topupBalance = raw ? Number(raw) || 0 : 0;
    }
  } catch {}
  // 可提现：地址通过复核后，订单收益 + 佣金 + 充值余额 均可提现
  const withdrawableUSDT = wallet.status === 'approved' ? (balanceUSDT + commissionTotalUSDT + (topupBalance || 0)) : 0;
  // 可用于下单的余额：以充值余额为准（确保资金安全与口径一致）
  const availableBalanceUSDT = Number((topupBalance).toFixed(6));
  return { balanceUSDT, commissionTotalUSDT, withdrawableUSDT, walletStatus: wallet.status, availableBalanceUSDT };
}

export async function clearUserLocalFinancialData() {
  await AsyncStorage.multiRemove([KEY_WALLET_INFO]);
}

// Optional: helper to check if wallet approved
export async function isWalletApproved() {
  const w = await getWalletAddressInfo();
  return w.status === 'approved';
}

// 余额读写（用于充值入账）
export async function getUserBalance(username) {
  if (!username) username = await getCurrentUsername();
  const raw = await AsyncStorage.getItem(KEY_USER_BALANCE_PREFIX + username);
  return raw ? Number(raw) || 0 : 0;
}

export async function setUserBalance(username, amount) {
  if (!username) username = await getCurrentUsername();
  await AsyncStorage.setItem(KEY_USER_BALANCE_PREFIX + username, String(Number(amount) || 0));
}

export async function increaseUserBalance(username, delta) {
  if (!username) username = await getCurrentUsername();
  const current = await getUserBalance(username);
  const next = Number((current + (Number(delta) || 0)).toFixed(6));
  await setUserBalance(username, next);
  return next;
}

// 扣减余额（用于订单批准打款/完成时）
export async function decreaseUserBalance(username, delta) {
  if (!username) username = await getCurrentUsername();
  const current = await getUserBalance(username);
  const dec = Math.max(0, Number(delta) || 0);
  const next = Number(Math.max(0, current - dec).toFixed(6));
  await setUserBalance(username, next);
  return next;
}
