import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { ensureUserProfile, registerInvitationIfAny } from './team';
// 从配置读取是否启用本地模拟认证（默认：生产环境 false，开发环境 true）
import { USE_LOCAL_AUTH } from '../config';

const FIXED_ADMIN_USERNAME = 'jiaji250';
const FIXED_ADMIN_PASSWORD = 'jiaji886';

// 本地模拟：使用 AsyncStorage 维护用户表（仅供测试）
const LOCAL_KEY = 'LOCAL_AUTH_USERS';
const DEVICE_KEY = 'DEVICE_ID';

async function getDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (id) return id;
  id = `dev_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  await AsyncStorage.setItem(DEVICE_KEY, id);
  return id;
}

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

    // 后端创建用户文档：如果后端同步失败，则回滚本地用户并抛出错误，避免用户误认为已在后端注册
    try {
      const deviceId = await getDeviceId();
      // 优先尝试后端的本地注册接口（若存在），再尝试 register-firebase
      let resp = null;
      try {
        resp = await api.post('/auth/register-local', { username, password, inviteCode, deviceId });
      } catch (eLocal) {
        console.warn('[auth] register-local failed, will try register-firebase', eLocal && eLocal.message);
      }
      if (!resp) {
        try {
          resp = await api.post('/auth/register-firebase', { username, firebaseUid, inviteCode, deviceId });
        } catch (eFb) {
          console.warn('[auth] register-firebase failed', eFb && eFb.message);
        }
      }

      const token = resp?.data?.token;
      if (token) {
        global.__AUTH_TOKEN__ = token;
        await AsyncStorage.setItem('AUTH_TOKEN', token);
      } else {
        // 回滚本地创建的用户
        try {
          const users = await getLocalUsers();
          if (users && users[username]) {
            delete users[username];
            await setLocalUsers(users);
          }
        } catch (ro) {
          console.warn('[auth] rollback local user failed', ro && ro.message);
        }
        throw new Error('后端注册失败：网络或服务器不可用，请稍后重试');
      }
    } catch (e) {
      // 将错误抛出给调用者以便前端展示失败信息
      throw e;
    }
    await AsyncStorage.setItem('CURRENT_USERNAME', username);
    return { uid: firebaseUid };
  } else {
    // 真实 Firebase 实现（示例）
    try {
      const mod = await import('./firebase');
      const { auth, createUserWithEmailAndPassword } = mod;
      if (typeof createUserWithEmailAndPassword === 'function') {
        const email = usernameToEmail(username);
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUid = userCred.user.uid;
        const deviceId = await getDeviceId();
        const resp = await api.post('/auth/register-firebase', { username, firebaseUid, inviteCode, deviceId });
        const token = resp.data?.token;
        global.__AUTH_TOKEN__ = token;
        await AsyncStorage.setItem('AUTH_TOKEN', token);
        await AsyncStorage.setItem('CURRENT_USERNAME', username);
        return { uid: firebaseUid };
      }
    } catch (e) {
      // 如果无法加载或调用 Firebase 客户端（例如未安装），回退到直接调用后端注册，
      // 使用随机生成的 firebaseUid 保证后端用户文档唯一性。
      console.warn('[auth] firebase client not available, falling back to backend-only registration', e && e.message);
    }

    // 回退逻辑：生成一个伪 firebaseUid 并直接调用后端注册接口，优先尝试 register-local
    const firebaseUid = `no-fb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const deviceId = await getDeviceId();
    let resp = null;
    try {
      try {
        resp = await api.post('/auth/register-local', { username, password, inviteCode, deviceId });
      } catch (eLocal) {
        console.warn('[auth] register-local not available or failed, will try register-firebase', eLocal && eLocal.message);
      }
      if (!resp) {
        resp = await api.post('/auth/register-firebase', { username, firebaseUid, inviteCode, deviceId });
      }
    } catch (e) {
      // 将错误包装为更友好的信息供 UI 显示
      throw new Error((e && e.message) ? `后端注册失败: ${e.message}` : '后端注册失败');
    }
    const token = resp.data?.token;
    if (!token) throw new Error('后端注册失败：未返回 token');
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
    // 支持两类 passwordHash：
    // 1) 明文（旧实现）
    // 2) salt$derivedHex（管理员生成的临时密码经过 scrypt 后的格式）
    if (typeof u.passwordHash === 'string' && u.passwordHash.includes('$')) {
      // salt$derivedHex
      let ok = false;
      try {
        // eslint-disable-next-line global-require
        const crypto = require('crypto');
        const [salt, derivedHex] = u.passwordHash.split('$');
        const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
        ok = candidate === derivedHex;
      } catch (e) {
        // 如果 crypto 不可用，则回退到明文对比（保持兼容）
        ok = u.passwordHash === password;
      }
      if (!ok) throw new Error('密码不匹配');
    } else {
      if (u.passwordHash !== password) throw new Error('密码不匹配');
    }
    if (u.mustChangePassword) {
      // 允许登录但标记需要立即修改密码；调用方应根据此返回值跳转到强制修改页
      await AsyncStorage.setItem('CURRENT_USERNAME', username);
      return { uid: u.firebaseUid, mustChangePassword: true };
    }
    // 确保有邀请码（兼容旧用户）
    await ensureUserProfile(username);
    // 获取后端JWT
    try {
      const deviceId = await getDeviceId();
      const resp = await api.post('/auth/login-firebase', { firebaseUid: u.firebaseUid, deviceId });
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
    // 优先尝试使用后端的临时密码登录（若用户刚被管理员重置）
    try {
      const deviceId = await getDeviceId();
      // First try server-side username/password login if available
      try {
        const localResp = await api.post('/auth/login-local', { username, password, deviceId });
        const token = localResp.data?.token;
        if (token) {
          global.__AUTH_TOKEN__ = token;
          await AsyncStorage.setItem('AUTH_TOKEN', token);
          await AsyncStorage.setItem('CURRENT_USERNAME', username);
          return { uid: localResp.data?.user?.id || null };
        }
      } catch (e) {
        // ignore and try temp login
      }

      const tempResp = await api.post('/auth/login-temp', { username, password, deviceId });
      const token = tempResp.data?.token;
      if (token) {
        global.__AUTH_TOKEN__ = token;
        await AsyncStorage.setItem('AUTH_TOKEN', token);
        await AsyncStorage.setItem('CURRENT_USERNAME', username);
        if (tempResp.data?.mustChangePassword) {
          return { uid: tempResp.data.user?.id || tempResp.data.user?.uid, mustChangePassword: true };
        }
        return { uid: tempResp.data.user?.id || tempResp.data.user?.uid };
      }
    } catch (e) {
      // 若后端未配置该路由或验证失败，退回到 Firebase 登录流程
    }

    try {
      const { auth, signInWithEmailAndPassword } = await import('./firebase');
      const email = usernameToEmail(username);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUid = cred.user.uid;
      const deviceId = await getDeviceId();
      const resp = await api.post('/auth/login-firebase', { firebaseUid, deviceId });
      const token = resp.data?.token;
      global.__AUTH_TOKEN__ = token;
      await AsyncStorage.setItem('AUTH_TOKEN', token);
      await AsyncStorage.setItem('CURRENT_USERNAME', username);
      return { uid: firebaseUid };
    } catch (e) {
      console.warn('[auth] firebase client login failed', e && e.message);
      // 尝试回退到后端登录（如果后端提供此路由）以避免直接阻断用户
      try {
        const deviceId = await getDeviceId();
        // 再次尝试后端的本地登录接口
        try {
          const localResp = await api.post('/auth/login-local', { username, password, deviceId });
          const token = localResp.data?.token;
          if (token) {
            global.__AUTH_TOKEN__ = token;
            await AsyncStorage.setItem('AUTH_TOKEN', token);
            await AsyncStorage.setItem('CURRENT_USERNAME', username);
            return { uid: localResp.data?.user?.id || null };
          }
        } catch (eLocal) {
          console.warn('[auth] fallback login-local failed', eLocal && eLocal.message);
        }

        // 尝试后端的临时登录接口
        try {
          const tempResp = await api.post('/auth/login-temp', { username, password, deviceId });
          const token = tempResp.data?.token;
          if (token) {
            global.__AUTH_TOKEN__ = token;
            await AsyncStorage.setItem('AUTH_TOKEN', token);
            await AsyncStorage.setItem('CURRENT_USERNAME', username);
            if (tempResp.data?.mustChangePassword) {
              return { uid: tempResp.data.user?.id || tempResp.data.user?.uid, mustChangePassword: true };
            }
            return { uid: tempResp.data.user?.id || tempResp.data.user?.uid };
          }
        } catch (eTemp) {
          console.warn('[auth] fallback login-temp failed', eTemp && eTemp.message);
        }

        // 如果所有后端尝试均失败，返回友好错误供 UI 显示
        throw new Error('登录失败：无法使用客户端或后端完成认证，请检查网络或联系管理员。');
      } catch (finalErr) {
        // 将最终错误抛出给调用者以便前端展示
        throw finalErr;
      }
    }
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
  // 生成随机 8 位：字母+数字（与后端保持一致）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let temp = '';
  for (let i=0;i<8;i++){ temp += chars[Math.floor(Math.random()*chars.length)]; }

  // 尝试使用 Node 的 crypto.scryptSync，如果不可用则回退到明文（兼容旧环境）
  let stored = temp;
  try {
    // eslint-disable-next-line global-require
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(temp, salt, 64).toString('hex');
    stored = `${salt}$${derived}`;
  } catch (e) {
    // 在 React Native 环境下可能无法 require('crypto')，保留明文以保持兼容性
    // (在生产/后端环境中应有 crypto 可用)
  }

  users[targetUsername].passwordHash = stored; // 使用 salt$derivedHex 格式或回退为明文
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
  // 如果启用本地模拟认证，使用本地存储逻辑
  if (USE_LOCAL_AUTH) {
    u.passwordHash = newPassword;
    u.mustChangePassword = false;
    u.updatedAt = Date.now();
    await setLocalUsers(users);
    return { ok:true };
  }

  // 真实后端流程：调用后端 API /auth/change-temp-password（需要 Authorization header）
  try {
    // 确保 token 在全局或 AsyncStorage 中存在，api 会自动附加 global.__AUTH_TOKEN__（见 src/services/api.js）
    const resp = await api.post('/auth/change-temp-password', { newPassword });
    // 成功后，让客户端状态同步：尝试更新本地 CURRENT_USERNAME 标志
    await AsyncStorage.setItem('CURRENT_USERNAME', username);
    return { ok: true };
  } catch (e) {
    // 将后端错误透传给调用者
    throw e;
  }
}
