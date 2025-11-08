import AsyncStorage from '@react-native-async-storage/async-storage';

// 旧平台系数 KEY（保留以兼容商家 USD 单价调节逻辑，不与展示用比例混淆）
const KEY_PLATFORM_RATE = 'PLATFORM_USDT_USD_RATE';
const DEFAULT_RATE = 1.00; // 仅用于影响商家 unitPrice 的乘子

// 新展示用多币种比例 KEY
const KEY_DISPLAY_RATES = 'PLATFORM_DISPLAY_RATES_V1'; // 存 JSON {USD,CNY,KRW,JPY}
// 默认展示比例（1 USDT = ? 目标货币）——根据最新需求：USD=1, CNY=11, KRW=2250, JPY=237
const DEFAULT_DISPLAY_RATES = { USD:1, CNY:11, KRW:2250, JPY:237 };

// 是否使用展示 USD 比例影响商家定价（默认开启以满足“需要影响商家定价”的新需求）
const KEY_USE_DISPLAY_USD_FOR_PRICING = 'USE_DISPLAY_USD_FOR_PRICING';
// 固定关闭：按产品要求不开放该能力
const DEFAULT_USE_DISPLAY_USD_FOR_PRICING = false;

export async function getPlatformRate() {
  const raw = await AsyncStorage.getItem(KEY_PLATFORM_RATE);
  const v = raw ? Number(raw) : DEFAULT_RATE;
  return (isNaN(v) || v <= 0) ? DEFAULT_RATE : v;
}

export async function setPlatformRate(v) {
  if (typeof v !== 'number') v = Number(v);
  if (isNaN(v) || v <= 0) throw new Error('请输入合法的正数汇率');
  await AsyncStorage.setItem(KEY_PLATFORM_RATE, String(v));
  return v;
}

// 将商家基准价（例如 9.0 美元）乘以平台调节系数
export async function getUseDisplayUSDForPricing() {
  // 固定返回 false，禁用“展示USD影响商家定价”能力
  return false;
}

export async function setUseDisplayUSDForPricing(val) {
  const v = !!val;
  await AsyncStorage.setItem(KEY_USE_DISPLAY_USD_FOR_PRICING, v ? '1' : '0');
  return v;
}

export async function applyRateToMerchantUnitPrice(basePrice) {
  const useDispUsd = await getUseDisplayUSDForPricing();
  if (useDispUsd) {
    const disp = await getDisplayRates();
    const usd = disp.USD || 1;
    return Number((Number(basePrice||0) * usd).toFixed(6));
  } else {
    const r = await getPlatformRate();
    return Number((Number(basePrice||0) * r).toFixed(6));
  }
}

// 读取基础汇率集合
// ===== 展示比例的读写（新） =====
export async function getDisplayRates() {
  try {
    const raw = await AsyncStorage.getItem(KEY_DISPLAY_RATES);
    if (!raw) return { ...DEFAULT_DISPLAY_RATES };
    const obj = JSON.parse(raw);
    const merged = { ...DEFAULT_DISPLAY_RATES, ...obj };
    // 校验合法性（>0 数字），非法回退默认
    Object.keys(merged).forEach(k => {
      const v = merged[k];
      if (typeof v !== 'number' || isNaN(v) || v <= 0) merged[k] = DEFAULT_DISPLAY_RATES[k];
    });
    return merged;
  } catch { return { ...DEFAULT_DISPLAY_RATES }; }
}

export async function setDisplayRates(partial) {
  const current = await getDisplayRates();
  const next = { ...current };
  Object.keys(partial).forEach(k => {
    if (!(k in next)) return;
    let v = Number(partial[k]);
    if (isNaN(v) || v <= 0) throw new Error(`${k} 比例非法`);
    next[k] = v;
  });
  await AsyncStorage.setItem(KEY_DISPLAY_RATES, JSON.stringify(next));
  return next;
}

// ===== 兼容旧 baseRates 接口 (CNY/KRW/JPY) =====
export async function getBaseRates() {
  const disp = await getDisplayRates();
  return { CNY: disp.CNY, KRW: disp.KRW, JPY: disp.JPY };
}
export async function setBaseRates(partial) {
  const payload = {};
  if (partial.CNY !== undefined) payload.CNY = partial.CNY;
  if (partial.KRW !== undefined) payload.KRW = partial.KRW;
  if (partial.JPY !== undefined) payload.JPY = partial.JPY;
  const next = await setDisplayRates(payload);
  return { CNY: next.CNY, KRW: next.KRW, JPY: next.JPY };
}

// 根据语言选择本地币种
export function getLocalCurrencyByLang(lang) {
  if (lang === 'zh') return 'CNY';
  if (lang === 'ko') return 'KRW';
  if (lang === 'ja') return 'JPY';
  return 'USD';
}

// 获取语言对应基础汇率（USD 视为 1）
export async function getBaseRateForLang(lang) {
  const currency = getLocalCurrencyByLang(lang);
  const disp = await getDisplayRates();
  return disp[currency] || 1;
}

// USD 金额转换为本地币金额
export async function toLocalFromUSD(amountUSD, lang) {
  const rateLocal = await getBaseRateForLang(lang); // 展示比例
  return amountUSD * rateLocal;
}

// 新：基于展示比例的通用换算 (amountUSD -> local currency 使用相对 USD 比例)
export async function toLocalFromUSD_v2(amountUSD, lang) {
  if (typeof amountUSD !== 'number') amountUSD = Number(amountUSD) || 0;
  const disp = await getDisplayRates();
  const rateLocal = await getBaseRateForLang(lang); // already from disp
  const rateUSD = disp.USD || 1; // USD 展示基准
  return amountUSD * (rateLocal / rateUSD);
}

// 货币符号
export function getCurrencySymbol(currency) {
  switch(currency){
    case 'CNY': return '¥';
    case 'KRW': return '₩';
    case 'JPY': return '¥';
    case 'USD': default: return '$';
  }
}

// 格式化本地金额（KRW/JPY 无小数，其他保留 2 位）
export function formatLocalCurrency(amount, currency) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  const symbol = getCurrencySymbol(currency);
  if (currency === 'KRW' || currency === 'JPY') {
    return symbol + Math.round(amount).toString();
  }
  return symbol + amount.toFixed(2);
}

// 利润计算（本地币）
export async function calcLocalProfit({ amountUSDT, unitPriceUSD, feeRateTotal = 0.05, lang }) {
  const disp = await getDisplayRates();
  const rateLocal = await getBaseRateForLang(lang);
  const rateUSD = disp.USD || 1;
  // 盈亏以“对比基准 USD 展示值 (disp.USD)”计算
  const profitPerUSDT_USD = unitPriceUSD * (1 - feeRateTotal) - 1; // 基于真实 USD 不变的利润
  // 将 USD 盈亏转为本地：如果展示 USD 比例不是 1，则以 rateLocal/rateUSD 归一化
  const profitLocal = profitPerUSDT_USD * amountUSDT * (rateLocal / rateUSD);
  return profitLocal;
}