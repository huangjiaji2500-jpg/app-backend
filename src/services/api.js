import axios from 'axios';
import { Platform } from 'react-native';

// 默认内置后端地址（生产/public）——用户指定的 Vercel 公网地址
const DEFAULT_API = 'https://app-tau-gilt-23.vercel.app/api/';

// GitHub raw 上的远程配置（可通过修改该文件切换后端地址而无需重建 APK）
const REMOTE_CONFIG_RAW = 'https://raw.githubusercontent.com/huangjiaji2500-jpg/app-backend/main/config.json';

// 初始使用内置默认地址；稍后异步尝试拉取远程配置并更新 baseURL
const initialBase = (process && process.env && process.env.API_BASE_URL) ? process.env.API_BASE_URL : DEFAULT_API;
let apiBase = initialBase;

// If developer used localhost during development and running on Android emulator, map localhost -> 10.0.2.2
try {
  if (apiBase.includes('localhost') && Platform.OS === 'android') {
    apiBase = apiBase.replace('localhost', '10.0.2.2');
  }
} catch (e) {
  // ignore
}

export const api = axios.create({
  baseURL: apiBase,
  timeout: 10000,
});

// 打印初始 baseURL，帮助定位运行时是否被覆盖
console.log('[api] initial baseURL =', api.defaults.baseURL);

// 异步拉取远程配置并在成功时更新 api.defaults.baseURL
async function initRemoteConfig() {
  try {
    const resp = await axios.get(REMOTE_CONFIG_RAW, { timeout: 5000 });
    const data = resp && resp.data;
    if (data && data.API_BASE_URL) {
      let url = data.API_BASE_URL;
      // 同样处理 localhost->10.0.2.2 在 Android 模拟器
      try {
        if (url.includes('localhost') && Platform.OS === 'android') url = url.replace('localhost', '10.0.2.2');
      } catch (e) {}
      api.defaults.baseURL = url;
      console.log('[api] remote config loaded, baseURL =', url);
      return;
    }
  } catch (e) {
    // 拉取失败，回退到内置默认（已在初始时使用）
    console.warn('[api] failed to load remote config, using default API base', e && e.message);
  }
  // ensure baseURL is the public default if nothing else
  api.defaults.baseURL = DEFAULT_API;
}

// fire-and-forget
initRemoteConfig();

// 请求拦截器：附加token（如果有）
api.interceptors.request.use((config) => {
  const token = global.__AUTH_TOKEN__;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  try {
    console.log('[api][request] ', config.method, config.baseURL, config.url);
  } catch (e) {}
  return config;
});

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    // 提供更详细的错误信息，帮助定位网络/后端问题
    try {
      console.error('[api][error] message=', error && error.message, 'code=', error && error.code, 'url=', error?.config?.url, 'baseURL=', error?.config?.baseURL, 'status=', error?.response?.status);
      if (error?.response?.data) console.error('[api][error] response.data=', error.response.data);
    } catch (e) {}
    const status = error?.response?.status;
    const serverMsg = error?.response?.data?.error || error?.response?.data || null;
    const msg = serverMsg || error.message || 'Network Error';
    const err = new Error(msg);
    if (status) err.status = status;
    if (serverMsg) err.serverMessage = serverMsg;
    return Promise.reject(err);
  }
);

export default api;