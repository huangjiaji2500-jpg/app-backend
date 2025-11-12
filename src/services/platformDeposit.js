import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCurrentUserAdmin } from './auth';
import { queuePlatformDepositSync } from './remoteSync';

const KEY_PLATFORM_DEPOSIT = 'PLATFORM_DEPOSIT_CONFIG';

// Shape: { address: string, qrImage: string(base64), note: string, updatedAt: number }
export async function getPlatformDepositAddress() {
  try {
    const raw = await AsyncStorage.getItem(KEY_PLATFORM_DEPOSIT);
    if (!raw) return { address: '', qrImage: '', note: '', updatedAt: null };
    return JSON.parse(raw);
  } catch {
    return { address: '', qrImage: '', note: '', updatedAt: null };
  }
}

export async function savePlatformDepositAddress({ address, qrImage, note }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) throw new Error('not_admin');
  const payload = { address: address || '', qrImage: qrImage || '', note: note || '', updatedAt: Date.now() };
  await AsyncStorage.setItem(KEY_PLATFORM_DEPOSIT, JSON.stringify(payload));
  try { await queuePlatformDepositSync(payload); } catch {}
  return payload;
}
