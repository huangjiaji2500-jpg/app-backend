import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'PAYMENT_METHODS';

export async function getPaymentMethods() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function savePaymentMethods(list) {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
  catch (e) { console.error('savePaymentMethods error', e); }
}

export async function addPaymentMethod(method) {
  const list = await getPaymentMethods();
  list.push({ ...method, id: Date.now().toString() });
  await savePaymentMethods(list);
  return list;
}

export async function updatePaymentMethod(id, patch) {
  const list = await getPaymentMethods();
  const idx = list.findIndex(m => m.id === id);
  if (idx >= 0) list[idx] = { ...list[idx], ...patch };
  await savePaymentMethods(list);
  return list[idx];
}

export async function removePaymentMethod(id) {
  const list = await getPaymentMethods();
  const next = list.filter(m => m.id !== id);
  await savePaymentMethods(next);
  return next;
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

export function validateMethod({ type, data }) {
  if (type === 'usdt_trc20') {
    if (!/^T[A-Za-z0-9]{33}$/.test(data.address || '')) return 'usdt_address_invalid';
    return null;
  }
  if (type === 'kakao_pay') {
    if (!/^010-\d{4}-\d{4}$/.test(data.kakaoPhone || '')) return 'kakao_phone_invalid';
    return null;
  }
  if (type === 'kr_bank_card') {
    if (!KR_BANKS.includes(data.bankName)) return 'bank_name_invalid';
    if (!/^\d{13,16}$/.test(data.bankCardNumber || '')) return 'bank_card_invalid';
    if (!data.accountName || !/^[A-Za-z가-힣 ]{1,50}$/.test(data.accountName)) return 'account_name_invalid';
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
  switch(method.type) {
    case 'kakao_pay': return `${t('method_kakao_pay')} ${method.data.kakaoPhone}`;
    case 'kr_bank_card': return `${t(BANK_NAME_MAP_I18N_KEYS[method.data.bankName])} ${maskCardNumber(method.data.bankCardNumber)}`;
    case 'visa': return `Visa ${maskCardNumber(method.data.cardNumber)}`;
    case 'mastercard': return `Mastercard ${maskCardNumber(method.data.cardNumber)}`;
    case 'usdt_trc20': return `${t('method_usdt_trc20')} ${method.data.address}`;
    default: return t('unknown_method_type');
  }
}
