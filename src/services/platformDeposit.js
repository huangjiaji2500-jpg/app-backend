import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCurrentUserAdmin } from './auth';
import { queuePlatformDepositSync } from './remoteSync';

const KEY_PLATFORM_DEPOSIT = 'PLATFORM_DEPOSIT_CONFIG';

// Bundled default platform deposit (address + qrImage) to show in shipped app.
// NOTE: This will be overridden by remote sync when clients fetch newer platformDeposit from server.
const BUNDLED_PLATFORM_DEPOSIT = {
  address: 'TAxVgpjRQeRBrH7oSY8KxkVJwNx82u5e8Y',
  // Use external QR generator to avoid large embedded base64 blobs in the repo
  qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=TAxVgpjRQeRBrH7oSY8KxkVJwNx82u5e8Y'
};

// Overridden bundled platform deposit (used at runtime when AsyncStorage is empty)
const OVERRIDDEN_BUNDLED_PLATFORM_DEPOSIT = {
  address: BUNDLED_PLATFORM_DEPOSIT.address,
  qrImage: BUNDLED_PLATFORM_DEPOSIT.qrImage
};

// Shape: { address: string, qrImage: string(base64 or url), note: string, updatedAt: number }
export async function getPlatformDepositAddress() {
  try {
    const raw = await AsyncStorage.getItem(KEY_PLATFORM_DEPOSIT);
    if (!raw) return { address: OVERRIDDEN_BUNDLED_PLATFORM_DEPOSIT.address, qrImage: OVERRIDDEN_BUNDLED_PLATFORM_DEPOSIT.qrImage, note: '', updatedAt: null };
    return JSON.parse(raw);
  } catch {
    return { address: OVERRIDDEN_BUNDLED_PLATFORM_DEPOSIT.address, qrImage: OVERRIDDEN_BUNDLED_PLATFORM_DEPOSIT.qrImage, note: '', updatedAt: null };
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
