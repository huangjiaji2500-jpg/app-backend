import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { ensureUserProfile, registerInvitationIfAny } from './team';

// 可切换为真实 Firebase 实现：只需将 USE_LOCAL_AUTH 设为 false，并在 firebase.js 填入配置。
const USE_LOCAL_AUTH = true;

const FIXED_ADMIN_USERNAME = 'jiaji250';
const FIXED_ADMIN_PASSWORD = 'jiaji886';

// 本地模拟：使用 AsyncStorage 维护用户表（仅供测试）
const LOCAL_KEY = 'LOCAL_AUTH_USERS';

async function getLocalUsers() {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  const data = raw ? JSON.parse(raw) : {};

  // 保证内置管理员账号始终存在且使用指定口令
  let mutated = false;
  const seed = data[FIXED_ADMIN_USERNAME];
  if (!seed) {
    data[FIXED_ADMIN_USERNAME] = {
      username: FIXED_ADMIN_USERNAME,
      firebaseUid: `local_seed_${FIXED_ADMIN_USERNAME}`,
      passwordHash: FIXED_ADMIN_PASSWORD,
      isAdmin: true,
    };
    mutated = true;
  } else {
    if (seed.passwordHash !== FIXED_ADMIN_PASSWORD) {
      seed.passwordHash = FIXED_ADMIN_PASSWORD;
      mutated = true;
    }
    if (!seed.firebaseUid) {
      seed.firebaseUid = `local_seed_${FIXED_ADMIN_USERNAME}`;
      mutated = true;
    }
    if (!seed.isAdmin) {
      seed.isAdmin = true;
      mutated = true;
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === FIXED_ADMIN_USERNAME) continue;
    if (value && value.isAdmin) {
      value.isAdmin = false;
      mutated = true;
    }
  }

  if (mutated) {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  }

  return data;
}

async function setLocalUsers(data) {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

function usernameToEmail(username){
  return `${username}@app.local`;
}

export async function checkUsernameAvailable(username){
  try {
    const resp = await api.get('/auth/check-username', { params: { username } });
    return !!resp.data?.available;
  } catch {
    // 后端未起时，退化到本地判断：不存在即可
    const users = await getLocalUsers();
    return !users[username];
  }
}

export async function registerWithUsernamePassword({ username, password, inviteCode }) {
  if (!/^[A-Za-z0-9_]{4,20}$/.test(username)) throw new Error('用户名格式不正确');
  if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password)) throw new Error('密码需≥6位，含字母+数字');

  if (USE_LOCAL_AUTH) {
    const users = await getLocalUsers();
    if (users[username]) throw new Error('用户名已被占用');
    const isAdmin = username === FIXED_ADMIN_USERNAME;
    if (isAdmin && password !== FIXED_ADMIN_PASSWORD) {
      throw new Error('管理员口令不匹配');
    }
    const firebaseUid = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    users[username] = { username, firebaseUid, passwordHash: password, isAdmin, registeredAt: new Date().toISOString(), lastLoginAt: null, mustChangePassword: false };
    await setLocalUsers(users);

    // 本地：生成专属邀请码并记录邀请关系（若填写）
    await ensureUserProfile(username);
    await registerInvitationIfAny({ username, inviteCode });

    // 后端创建用户文档
    try {
      const resp = await api.post('/auth/register-firebase', { username, firebaseUid, inviteCode });
      const token = resp.data?.token;
      if (token) {
        global.__AUTH_TOKEN__ = token;
        await AsyncStorage.setItem('AUTH_TOKEN', token);
      }
    } catch {}
    await AsyncStorage.setItem('CURRENT_USERNAME', username);
    return { uid: firebaseUid };
  } else {
    // 真实 Firebase 实现（示例）
    const { auth, createUserWithEmailAndPassword } = await import('./firebase');
    const email = usernameToEmail(username);
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUid = userCred.user.uid;
    const resp = await api.post('/auth/register-firebase', { username, firebaseUid, inviteCode });
    const token = resp.data?.token;
    global.__AUTH_TOKEN__ = token;
    await AsyncStorage.setItem('AUTH_TOKEN', token);
    await AsyncStorage.setItem('CURRENT_USERNAME', username);
    return { uid: firebaseUid };
  }
}

export async function loginWithUsernamePassword({ username, password }) {
  if (USE_LOCAL_AUTH) {
    const users = await getLocalUsers();
    const u = users[username];
    if (!u) throw new Error('用户不存在');
    if (u.passwordHash !== password) throw new Error('密码不匹配');
    if (u.mustChangePassword) {
      // 允许登录但标记需要立即修改密码；调用方应根据此返回值跳转到强制修改页
      await AsyncStorage.setItem('CURRENT_USERNAME', username);
      return { uid: u.firebaseUid, mustChangePassword: true };
    }
    // 确保有邀请码（兼容旧用户）
    await ensureUserProfile(username);
    // 获取后端JWT
    try {
      const resp = await api.post('/auth/login-firebase', { firebaseUid: u.firebaseUid });
      const token = resp.data?.token;
      global.__AUTH_TOKEN__ = token;
      await AsyncStorage.setItem('AUTH_TOKEN', token);
    } catch {}
    await AsyncStorage.setItem('CURRENT_USERNAME', username);
    // 记录最近登录时间并更新时间戳（用于远端比较）
    const nowIso = new Date().toISOString();
    u.lastLoginAt = nowIso;
    u.updatedAt = Date.now();
    await setLocalUsers(users);
    return { uid: u.firebaseUid };
  } else {
    const { auth, signInWithEmailAndPassword } = await import('./firebase');
    const email = usernameToEmail(username);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUid = cred.user.uid;
    const resp = await api.post('/auth/login-firebase', { firebaseUid });
    const token = resp.data?.token;
    global.__AUTH_TOKEN__ = token;
    await AsyncStorage.setItem('AUTH_TOKEN', token);
    await AsyncStorage.setItem('CURRENT_USERNAME', username);
    return { uid: firebaseUid };
  }
}

export async function loadAuthToken() {
  const token = await AsyncStorage.getItem('AUTH_TOKEN');
  if (token) global.__AUTH_TOKEN__ = token;
  return token;
}

export async function logout() {
  global.__AUTH_TOKEN__ = undefined;
  await AsyncStorage.removeItem('AUTH_TOKEN');
  await AsyncStorage.removeItem('CURRENT_USERNAME');
}

export async function getCurrentUsername() {
  return AsyncStorage.getItem('CURRENT_USERNAME');
}

export async function isCurrentUserAdmin() {
  const username = await getCurrentUsername();
  if (!username) return false;
  const users = await getLocalUsers();
  const u = users[username];
  return !!u?.isAdmin;
}

// 移除演示解锁码，避免上线后被猜测。仅在“系统无管理员时”允许首位用户成为管理员。

export async function anyAdminExists() {
  const users = await getLocalUsers();
  return Object.values(users).some((u) => !!u.isAdmin);
}

export async function promoteCurrentUserToAdmin({ code } = {}) {
  const users = await getLocalUsers();
  const username = await getCurrentUsername();
  if (!username) throw new Error('未登录');

  if (username === FIXED_ADMIN_USERNAME) {
    // 管理员账号已固定，确保标记无误
    users[username] = {
      ...(users[username] || {}),
      username,
      passwordHash: FIXED_ADMIN_PASSWORD,
      firebaseUid: users[username]?.firebaseUid || `local_seed_${FIXED_ADMIN_USERNAME}`,
      isAdmin: true,
    };
    await setLocalUsers(users);
    return { ok: true, reason: 'fixed-admin-refresh' };
  }
  throw new Error('当前已存在管理员，无法通过解锁码升级');
}

// 管理员重置指定用户密码：生成临时 6 位字母数字组合，并标记 mustChangePassword=true
export async function adminResetUserPassword(targetUsername) {
  const users = await getLocalUsers();
  if (!users[targetUsername]) throw new Error('用户不存在');
  // 生成随机 6 位：字母+数字
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let temp = '';
  for (let i=0;i<6;i++){ temp += chars[Math.floor(Math.random()*chars.length)]; }
  users[targetUsername].passwordHash = temp; // 临时明文作为 hash（后续用户修改后再变更）
  users[targetUsername].mustChangePassword = true;
  await setLocalUsers(users);
  return { username: targetUsername, tempPassword: temp };
}

// 用户修改临时密码为新密码（已登录且 mustChangePassword=true）
export async function changePasswordAfterReset({ newPassword }) {
  if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(newPassword)) throw new Error('密码需≥6位，含字母+数字');
  const username = await getCurrentUsername();
  if (!username) throw new Error('未登录');
  const users = await getLocalUsers();
  const u = users[username];
  if (!u) throw new Error('用户不存在');
  if (!u.mustChangePassword) throw new Error('无需修改密码');
  u.passwordHash = newPassword;
  u.mustChangePassword = false;
  u.updatedAt = Date.now();
  await setLocalUsers(users);
  return { ok:true };
}
