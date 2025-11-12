import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUsername } from './auth';
import { queuePaymentMethodSync } from './remoteSync';

// 统一数据模型：{ id, type, data, createdAt, updatedAt, isDefault }
// 兼容旧结构：可能缺少 createdAt/updatedAt/isDefault 或 id 不规范。
const STORAGE_KEY = 'PAYMENT_METHODS';

function nowISO(){ return new Date().toISOString(); }

async function migrate(list = []) {
  let changed = false;
  const normalized = list.map((m, idx) => {
    const id = m.id || `${Date.now()}_${idx}`;
    const createdAt = m.createdAt || nowISO();
    const updatedAt = m.updatedAt || createdAt;
    // 旧版没有 isDefault：首条或已标记一个默认；若全部无默认则设第一条为默认
    return {
      id,
      type: m.type,
      data: m.data || m.fields || {},
      createdAt,
      updatedAt,
      isDefault: !!m.isDefault,
    };
  });
  if (!normalized.some(m => m.isDefault) && normalized.length > 0) {
    normalized[0].isDefault = true; changed = true;
  }
  if (changed || normalized.some((m,i)=> list[i] !== m)) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export async function getPaymentMethods() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return await migrate(list);
  } catch (e) { return []; }
}

export async function savePaymentMethods(list) {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
  catch (e) { console.error('savePaymentMethods error', e); }
}

export async function addPaymentMethod(method) {
  const list = await getPaymentMethods();
  const item = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    type: method.type,
    data: method.data || {},
    createdAt: nowISO(),
    updatedAt: nowISO(),
    isDefault: list.length === 0, // 第一条自动设默认
  };
  list.push(item);
  await savePaymentMethods(list);
  try {
    const username = await getCurrentUsername();
    await queuePaymentMethodSync({ ...item, username });
  } catch {}
  return list;
}

export async function updatePaymentMethod(id, patch) {
  const list = await getPaymentMethods();
  const idx = list.findIndex(m => m.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, updatedAt: nowISO() };
    await savePaymentMethods(list);
    try {
      const username = await getCurrentUsername();
      await queuePaymentMethodSync({ ...list[idx], username });
    } catch {}
    return list[idx];
  }
  return null;
}

export async function removePaymentMethod(id) {
  const list = await getPaymentMethods();
  const next = list.filter(m => m.id !== id);
  // 若删除的是默认且仍有剩余，设第一条为默认
  if (!next.some(m => m.isDefault) && next.length > 0) next[0].isDefault = true;
  await savePaymentMethods(next);
  try {
    const username = await getCurrentUsername();
    // send deletion as isDefault may have changed on others; queue all remaining + a tombstone could be added later if needed
    for (const m of next){ await queuePaymentMethodSync({ ...m, username }); }
  } catch {}
  return next;
}

export async function setDefaultPaymentMethod(id) {
  const list = await getPaymentMethods();
  let found = false;
  for (const m of list) {
    if (m.id === id) { m.isDefault = true; m.updatedAt = nowISO(); found = true; }
    else if (m.isDefault) { m.isDefault = false; m.updatedAt = nowISO(); }
  }
  if (found) await savePaymentMethods(list);
  try {
    const username = await getCurrentUsername();
    for (const m of list){ await queuePaymentMethodSync({ ...m, username }); }
  } catch {}
  return list;
}

export async function getDefaultPaymentMethod() {
  const list = await getPaymentMethods();
  return list.find(m => m.isDefault) || null;
}

// Luhn 算法
function luhnCheck(num) {
  const s = String(num).replace(/\D/g,'');
  let sum = 0; let toggle = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i], 10);
    if (toggle) { n *= 2; if (n > 9) n -= 9; }
    sum += n; toggle = !toggle;
  }
  return (sum % 10) === 0;
}

const KR_BANKS = ['KEB','SHINHAN','KB','WOORI'];
// Validation mode: 'strict' enforces original rules; 'loose' accepts common variants and CJK names.
// Set to 'loose' to minimize blocked inputs for users. Change to 'strict' if you want stricter checks.
const VALIDATION_MODE = 'loose';

export function validateMethod({ type, data }) {
  if (type === 'usdt_trc20') {
    if (!/^T[A-Za-z0-9]{33}$/.test(data.address || '')) return 'usdt_address_invalid';
    return null;
  }
  if (type === 'kakao_pay') {
    const raw = (data.kakaoPhone || '').trim();
    if (VALIDATION_MODE === 'strict') {
      if (!/^010-\d{4}-\d{4}$/.test(raw)) return 'kakao_phone_invalid';
      return null;
    }
    // loose mode: accept common variants: digits-only, with/without hyphens/spaces, and a wide digit length
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return 'kakao_phone_invalid';
    // prefer numbers that include 010 or start with country code; otherwise still accept to be permissive
    if (!digits.startsWith('010') && !digits.startsWith('82') && digits.length < 9) return 'kakao_phone_invalid';
    return null;
  }
  if (type === 'kr_bank_card') {
    if (!KR_BANKS.includes(data.bankName)) return 'bank_name_invalid';
    if (!/^\d{13,16}$/.test(data.bankCardNumber || '')) return 'bank_card_invalid';
    if (!data.accountName) return 'account_name_invalid';
    if (VALIDATION_MODE === 'strict') {
      if (!/^[A-Za-z가-힣 ]{1,50}$/.test(data.accountName)) return 'account_name_invalid';
    } else {
      // loose: allow CJK unified ideographs (Chinese), spaces, dots and hyphens
      if (!/^[A-Za-z가-힣\u4e00-\u9fff .\-]{1,50}$/.test(data.accountName)) return 'account_name_invalid';
    }
    return null;
  }
  if (type === 'visa' || type === 'mastercard') {
    const num = data.cardNumber || '';
    if (type === 'visa') {
      if (!/^4\d{12}(\d{3})?$/.test(num)) return 'visa_number_invalid';
    } else { // mastercard
      if (!/^5\d{15}$/.test(num)) return 'mastercard_number_invalid';
    }
    if (!luhnCheck(num)) return 'card_luhn_invalid';
    if (!data.cardHolder || !/^[A-Za-z가-힣\u4e00-\u9fa5 ]{1,50}$/.test(data.cardHolder)) return 'card_holder_invalid';
    if (!/^\d{2}\/\d{2}$/.test(data.expiry || '')) return 'card_expiry_invalid';
    // 有效期检查
    const [mm, yy] = (data.expiry || '').split('/');
    const month = parseInt(mm,10); const year = 2000 + parseInt(yy,10);
    const now = new Date();
    if (month < 1 || month > 12) return 'card_expiry_invalid';
    const expiryDate = new Date(year, month, 0); // 当月最后一天
    if (expiryDate < new Date(now.getFullYear(), now.getMonth(), 1)) return 'card_expiry_past';
    if (!/^\d{3}$/.test(data.cvv || '')) return 'card_cvv_invalid';
    // CVV 不存储：调用方保存前应删除 data.cvv
    return null;
  }
  return 'unsupported_method_type';
}

export const BANK_NAME_MAP_I18N_KEYS = {
  KEB: 'bank_name_keb_hana',
  SHINHAN: 'bank_name_shinhan',
  KB: 'bank_name_kb',
  WOORI: 'bank_name_woori'
};

export function maskCardNumber(num) {
  if (!num) return '****';
  const s = String(num).replace(/\D/g,'');
  return '**** ' + s.slice(-4);
}

export function getDisplayName(method, t) {
  const base = (() => {
    switch(method.type) {
      case 'kakao_pay': return `${t('method_kakao_pay')} ${method.data.kakaoPhone}`;
      case 'kr_bank_card': return `${t(BANK_NAME_MAP_I18N_KEYS[method.data.bankName])} ${maskCardNumber(method.data.bankCardNumber)}`;
      case 'visa': return `Visa ${maskCardNumber(method.data.cardNumber)}`;
      case 'mastercard': return `Mastercard ${maskCardNumber(method.data.cardNumber)}`;
      case 'usdt_trc20': return `${t('method_usdt_trc20')} ${method.data.address}`;
      default: return t('unsupported_method_type');
    }
  })();
  return method.isDefault ? `${base} · ${t('default_method_label') || '默认'}` : base;
}

