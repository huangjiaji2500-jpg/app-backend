import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const KEY_CFG = 'CLOUD_FIREBASE_CONFIG';
const KEY_ENABLED = 'CLOUD_ENABLED';
const KEY_REMOTE_BASE = 'REMOTE_BASE_URL';
const KEY_SYNC_SECRET = 'SYNC_SECRET';

export async function getCloudEnabled() {
  try {
    const m = Constants?.expoConfig?.extra?.cloudEnabled;
    if (typeof m === 'boolean') return m;
  } catch {}
  const v = await AsyncStorage.getItem(KEY_ENABLED);
  return v === '1';
}

export async function setCloudEnabled(val) {
  await AsyncStorage.setItem(KEY_ENABLED, val ? '1' : '0');
}

export async function getFirebaseConfig() {
  try {
    const cfg = Constants?.expoConfig?.extra?.firebaseConfig;
    if (cfg && cfg.apiKey && cfg.projectId) return cfg;
  } catch {}
  const raw = await AsyncStorage.getItem(KEY_CFG);
  return raw ? JSON.parse(raw) : null;
}

export async function setFirebaseConfig(cfg) {
  await AsyncStorage.setItem(KEY_CFG, JSON.stringify(cfg || {}));
}

export async function getRemoteBaseUrl() {
  try {
    const v = Constants?.expoConfig?.extra?.remoteBaseUrl;
    if (typeof v === 'string' && v.startsWith('https://')) return v.replace(/\/$/, '');
  } catch {}
  const v = await AsyncStorage.getItem(KEY_REMOTE_BASE);
  return v ? v.replace(/\/$/, '') : '';
}

export async function setRemoteBaseUrl(url) {
  await AsyncStorage.setItem(KEY_REMOTE_BASE, url || '');
}

export async function getSyncSecret() {
  try {
    const v = Constants?.expoConfig?.extra?.syncSecret;
    if (typeof v === 'string' && v.length >= 12) return v;
  } catch {}
  return AsyncStorage.getItem(KEY_SYNC_SECRET);
}

export async function setSyncSecret(secret) {
  await AsyncStorage.setItem(KEY_SYNC_SECRET, secret || '');
}
