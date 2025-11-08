import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCurrentUserAdmin } from './auth';

const KEY = 'PLATFORM_CONFIG';
const DEFAULT_CONFIG = {
  // 仅在未曾保存或存储读取失败时使用的默认最小下单额度
  minOrderAmount: 200, // USDT (集中唯一硬编码来源)
};

// 导出默认配置供其它模块引用，避免在组件里再次硬编码数值
export const DEFAULT_PLATFORM_CONFIG = DEFAULT_CONFIG;

export async function getPlatformConfig() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const obj = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...(obj || {}) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function savePlatformConfig(patch = {}) {
  try {
    const current = await getPlatformConfig();
    const next = { ...current, ...(patch || {}) };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    throw e;
  }
}

export async function setMinOrderAmount(min) {
  const v = Number(min);
  if (!Number.isFinite(v) || v < 1) {
    throw new Error('Invalid min order amount');
  }
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) throw new Error('not_admin');
  return savePlatformConfig({ minOrderAmount: Math.floor(v) });
}

export async function getMinOrderAmount() {
  const cfg = await getPlatformConfig();
  return Number(cfg.minOrderAmount) || DEFAULT_CONFIG.minOrderAmount;
}
