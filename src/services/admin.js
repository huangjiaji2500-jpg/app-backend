import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfiles, getCommissions, getRelations } from './team';
import { getUserBalance } from './assets';
import { listOrders, ORDER_STATUS } from './orders';
import { adminResetUserPassword } from './auth';

const LOCAL_USERS_KEY = 'LOCAL_AUTH_USERS';
const LOCAL_ORDERS_KEY = 'LOCAL_ORDERS';

export async function getAllUsers() {
  const raw = await AsyncStorage.getItem(LOCAL_USERS_KEY);
  const users = raw ? JSON.parse(raw) : {};
  const profiles = await getUserProfiles();
  const relations = await getRelations();
  const list = [];
  const allOrders = await listOrders();
  const allCommissions = await getCommissions();
  for (const u of Object.values(users)) {
    const profile = profiles[u.username] || {};
    const inviteCode = profile.inviteCode || null;
    const directChildren = inviteCode && relations[inviteCode] ? relations[inviteCode].length : 0;
  const balance = await getUserBalance(u.username);
  const commissionSum = allCommissions.filter(c => c.toUsername === u.username).reduce((s,c)=> s + (Number(c.amountUSDT)||0), 0);
  const myCompletedOrders = allOrders.filter(o => (o.creatorUsername === u.username) && (o.status === ORDER_STATUS.COMPLETED));
  const ordersSum = myCompletedOrders.reduce((s,o)=> s + (Number(o.amountUSDT)||0), 0);
    list.push({
      username: u.username,
      isAdmin: !!u.isAdmin,
      firebaseUid: u.firebaseUid,
      registeredAt: u.registeredAt || null,
      lastLoginAt: u.lastLoginAt || null,
      mustChangePassword: !!u.mustChangePassword,
      inviteCode,
      inviterCode: profile.inviterCode || null,
      directChildren,
      balanceUSDT: Number(balance.toFixed(6)),
      withdrawableUSDT: Number((balance + commissionSum + ordersSum).toFixed(6)),
      updatedAt: u.updatedAt || (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : null) || Date.now(),
    });
  }
  return list;
}

export async function getAllOrders() {
  const raw = await AsyncStorage.getItem(LOCAL_ORDERS_KEY);
  const list = raw ? JSON.parse(raw) : [];
  return list;
}

export async function getAllCommissions() {
  const list = await getCommissions();
  return list;
}

export async function resetPasswordForUser(username) {
  const res = await adminResetUserPassword(username);
  return res; // { username, tempPassword }
}

// 简单 CSV 生成：返回 { filename, csv }
export async function exportUsersCsv(t, listOverride) {
  const users = Array.isArray(listOverride) ? listOverride : await getAllUsers();
  const header = [
    t ? t('csv_username') : '用户名',
    t ? t('csv_registered_time') : '注册时间',
    t ? t('csv_last_login_time') : '最近登录时间',
    t ? t('csv_balance_usdt') : '余额USDT',
    t ? t('csv_withdrawable_usdt') : '可提现金额',
    t ? t('csv_invite_code') : '邀请码',
    t ? t('csv_inviter_code') : '上级码',
    t ? t('csv_is_admin') : '是否管理员',
    t ? t('csv_direct_children') : '直推人数',
  ];
  const lines = [header.join(',')];
  const yes = t ? (t('yes') || 'Yes') : '是';
  const no = t ? (t('no') || 'No') : '否';
  for (const u of users) {
    const row = [
      u.username,
      u.registeredAt || '',
      u.lastLoginAt || '',
      (u.balanceUSDT ?? 0),
      (u.withdrawableUSDT ?? ''),
      u.inviteCode || '',
      u.inviterCode || '',
      u.isAdmin ? yes : no,
      u.directChildren || 0,
    ];
    lines.push(row.map(v => typeof v === 'string' && /[,"]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v).join(','));
  }
  const csv = lines.join('\n');
  const now = new Date();
  const pad = (n)=> String(n).padStart(2,'0');
  const filename = `用户列表_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
  return { filename, csv };
}