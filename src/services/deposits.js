import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUsername, isCurrentUserAdmin } from './auth';
import { increaseUserBalance } from './assets';
import { queueDepositSync } from './remoteSync';

const KEY_DEPOSITS = 'DEPOSIT_REQUESTS';

export async function listDeposits({ status, username } = {}) {
  const raw = await AsyncStorage.getItem(KEY_DEPOSITS);
  let list = raw ? JSON.parse(raw) : [];
  if (status) list = list.filter(x => x.status === status);
  if (username) list = list.filter(x => x.username === username);
  return list.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
}

export async function addDepositRequest({ amountRequestedUSDT, txHash = '', proofImage = '', noteUser = '' }) {
  const username = await getCurrentUsername();
  const item = {
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,8),
    username: username || 'unknown',
    amountRequestedUSDT: Number(amountRequestedUSDT) || 0,
    amountApprovedUSDT: null,
    txHash,
    proofImage,
    noteUser,
    status: 'pending',
    createdAt: Date.now(),
    reviewedAt: null,
    reviewerUsername: '',
    noteAdmin: '',
  };
  const list = await listDeposits();
  list.unshift(item);
  await AsyncStorage.setItem(KEY_DEPOSITS, JSON.stringify(list));
  try { queueDepositSync({ action:'submit', item }); } catch {}
  return item;
}

export async function approveDeposit(id, { amountApprovedUSDT, reviewerUsername, noteAdmin = '' }) {
  const admin = await isCurrentUserAdmin();
  if (!admin) throw new Error('not_admin');
  const raw = await AsyncStorage.getItem(KEY_DEPOSITS);
  const list = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) throw new Error('not_found');
  const item = list[idx];
  if (item.status !== 'pending') throw new Error('already_reviewed');
  const amt = Number(amountApprovedUSDT) || 0;
  list[idx] = { ...item, status: 'approved', amountApprovedUSDT: amt, reviewedAt: Date.now(), reviewerUsername, noteAdmin };
  await AsyncStorage.setItem(KEY_DEPOSITS, JSON.stringify(list));
  // increase user balance
  await increaseUserBalance(item.username, amt);
  try { queueDepositSync({ action:'approve', item: list[idx] }); } catch {}
  return list[idx];
}

export async function rejectDeposit(id, { reviewerUsername, noteAdmin = '' }) {
  const admin = await isCurrentUserAdmin();
  if (!admin) throw new Error('not_admin');
  const raw = await AsyncStorage.getItem(KEY_DEPOSITS);
  const list = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) throw new Error('not_found');
  const item = list[idx];
  if (item.status !== 'pending') throw new Error('already_reviewed');
  list[idx] = { ...item, status: 'rejected', amountApprovedUSDT: 0, reviewedAt: Date.now(), reviewerUsername, noteAdmin };
  await AsyncStorage.setItem(KEY_DEPOSITS, JSON.stringify(list));
  try { queueDepositSync({ action:'reject', item: list[idx] }); } catch {}
  return list[idx];
}
