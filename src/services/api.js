import axios from 'axios';
import { Platform } from 'react-native';

// 运行时决定 API 地址：优先使用构建时注入的 process.env.API_BASE_URL
// 否则默认指向本机开发服务器。注意：Android 模拟器内的 `localhost` 指向模拟器自身，
// 需要使用 `10.0.2.2` 访问宿主机上的服务（Android Emulator）。
let API_BASE_URL = (process && process.env && process.env.API_BASE_URL) ? process.env.API_BASE_URL : 'http://localhost:3000/api';
try {
  if (API_BASE_URL.includes('localhost') && Platform.OS === 'android') {
    API_BASE_URL = API_BASE_URL.replace('localhost', '10.0.2.2');
  }
} catch (e) {
  // Platform may be undefined in some environments; ignore
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器：附加token（如果有）
api.interceptors.request.use((config) => {
  const token = global.__AUTH_TOKEN__;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    // 提供更详细的错误信息，帮助定位网络/后端问题
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