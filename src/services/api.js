import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

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
    const msg = error?.response?.data?.error || error.message || 'Network Error';
    return Promise.reject(new Error(msg));
  }
);

export default api;