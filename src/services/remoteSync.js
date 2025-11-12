import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRemoteBaseUrl, getSyncSecret } from './cloudConfig';
import { getCurrentUsername } from './auth';
import * as Crypto from 'expo-crypto';

const QUEUE_KEY = 'REMOTE_SYNC_QUEUE_V1';
const SENT_LOG_KEY = 'REMOTE_SYNC_SENT_LOG_V1';
const MAX_RETRY = 5;
const BASE_BACKOFF_MS = 5000; // 5s 基础重试间隔，指数回退
const BACKOFF_FACTOR = 3; // 5s,15s,45s,135s,405s(~6.75m)
const MAX_BACKOFF_MS = 10 * 60 * 1000; // 封顶 10 分钟

async function loadQueue(){
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveQueue(list){
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

function now(){ return Date.now(); }

async function loadSentLog(){
  const raw = await AsyncStorage.getItem(SENT_LOG_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveSentLog(list){
  // 仅保留最近 100 条
  const pruned = list.slice(-100);
  await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify(pruned));
}

function mkId(){
  return `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

function computeBackoffMs(retry){
  const ms = BASE_BACKOFF_MS * Math.pow(BACKOFF_FACTOR, Math.max(0, retry || 0));
  return Math.min(ms, MAX_BACKOFF_MS);
}

async function signPayload(payload){
  const secret = await getSyncSecret();
  const json = JSON.stringify(payload);
  const base = `${json}|${secret||''}`;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base);
  return hash;
}

async function pushToQueue(item){
  const q = await loadQueue();
  const withId = { id: mkId(), ...item };
  q.push(withId);
  await saveQueue(q);
}

export async function queueOrderSync(order){
  const username = await getCurrentUsername();
  await pushToQueue({ type:'order', data: { order, username }, retry:0, createdAt: now(), lastTriedAt: 0 });
  try { processQueue(); } catch {}
}

export async function queueDepositSync(deposit){
  const username = await getCurrentUsername();
  await pushToQueue({ type:'deposit', data: { deposit, username }, retry:0, createdAt: now(), lastTriedAt: 0 });
  try { processQueue(); } catch {}
}

// New queue types
export async function queueUserSnapshot(userMeta){
  // userMeta: { username, registeredAt, lastLoginAt, inviteCode, inviterCode, isAdmin, updatedAt }
  await pushToQueue({ type:'user', data: { user: userMeta }, retry:0, createdAt: now(), lastTriedAt: 0 });
  try { processQueue(); } catch {}
}
export async function queuePaymentMethodSync(paymentMethod){
  // paymentMethod: { id, username, type, data, isDefault, updatedAt }
  await pushToQueue({ type:'payment-method', data: { paymentMethod }, retry:0, createdAt: now(), lastTriedAt: 0 });
  try { processQueue(); } catch {}
}
export async function queueRateSync(rate){
  // rate: { base, quote, value, updatedAt }
  await pushToQueue({ type:'rate', data: { rate }, retry:0, createdAt: now(), lastTriedAt: 0 });
  try { processQueue(); } catch {}
}
export async function queuePlatformDepositSync(platformDeposit){
  // platformDeposit: { address, qrImage, note, updatedAt }
  await pushToQueue({ type:'platform-deposit', data: { platformDeposit }, retry:0, createdAt: now(), lastTriedAt: 0 });
  try { processQueue(); } catch {}
}

let processing = false;
export async function processQueue(){
  if (processing) return;
  processing = true;
  try {
    const base = await getRemoteBaseUrl();
    if (!base) { processing = false; return; }
    let q = await loadQueue();
    const remaining = [];
    for (const item of q){
      try {
        // 未到重试时间则跳过
        const nextAt = (item.lastTriedAt||0) + computeBackoffMs(item.retry||0);
        if (item.lastTriedAt && Date.now() < nextAt){
          remaining.push(item);
          continue;
        }
        const payload = { ...item.data, ts: now(), type: item.type };
        const signature = await signPayload(payload);
        const res = await fetch(`${base}/api/sync/${item.type}`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'X-Sync-Signature': signature },
          body: JSON.stringify(payload),
        });
        if (!res.ok){ throw new Error(`status_${res.status}`); }
        // 成功：写入 sent log
        try {
          const sent = await loadSentLog();
          sent.push({ id: item.id, type: item.type, data: item.data, sentAt: Date.now() });
          await saveSentLog(sent);
        } catch {}
      } catch (e){
        const retry = (item.retry||0)+1;
        if (retry < MAX_RETRY){ remaining.push({ ...item, retry, lastTriedAt: Date.now() }); }
      }
    }
    await saveQueue(remaining);
  } finally {
    processing = false;
  }
}

// 拉取已同步远端数据（仅管理员界面调用），需要单独签名
export async function fetchRemoteLatest(){
  const base = await getRemoteBaseUrl();
  if (!base) return { orders:[], deposits:[], users:[], rates:[], paymentMethods:[], platformDeposit:null };
  const ts = Date.now();
  const secret = await getSyncSecret();
  const signature = secret ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${ts}|${secret}`) : '';
  try {
    const res = await fetch(`${base}/api/sync/list`, { headers:{ 'X-Ts': String(ts), 'X-Sync-Signature': signature } });
    if (!res.ok) throw new Error('bad_status_'+res.status);
    const json = await res.json();
    return {
      orders: json.orders||[],
      deposits: json.deposits||[],
      users: json.users||[],
      rates: json.rates||[],
      paymentMethods: json.paymentMethods||[],
      platformDeposit: json.platformDeposit || null
    };
  } catch { return { orders:[], deposits:[], users:[], rates:[], paymentMethods:[], platformDeposit:null }; }
}

export async function forceRetrySync(){ return processQueue(); }

// 启动时尝试处理一次（不阻塞首屏）
setTimeout(()=>{ processQueue(); }, 3000);

// Merge helpers (called by UI layer after fetchRemoteLatest)
export async function mergeRemoteData(remote){
  // remote: { users, paymentMethods, rates, platformDeposit }
  // Users: update local meta (excluding passwordHash). We only add fields if existing user.
  try {
    const { getAllUsers } = await import('./admin');
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const LOCAL_USERS_KEY = 'LOCAL_AUTH_USERS';
    const raw = await AsyncStorage.getItem(LOCAL_USERS_KEY);
    const localUsers = raw ? JSON.parse(raw) : {};
    for (const r of remote.users||[]) {
      const lu = localUsers[r.username];
      if (lu) {
        // Prefer newer timestamps
        if (!lu.updatedAt || (r.updatedAt && r.updatedAt > lu.updatedAt)) {
          lu.lastLoginAt = r.lastLoginAt || lu.lastLoginAt || null;
          lu.registeredAt = lu.registeredAt || r.registeredAt || null;
          lu.isAdmin = !!lu.isAdmin; // keep local authority
          lu.updatedAt = r.updatedAt || lu.updatedAt || Date.now();
        }
      }
    }
    await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
  } catch {}
  // Payment methods: simple merge by id & updatedAt
  try {
    const { getPaymentMethods, savePaymentMethods } = await import('./paymentMethods');
    const local = await getPaymentMethods();
    const byId = {}; local.forEach(m => byId[m.id] = m);
    for (const rm of remote.paymentMethods||[]) {
      const lm = byId[rm.id];
      if (!lm || (rm.updatedAt && rm.updatedAt > lm.updatedAt)) {
        byId[rm.id] = {
          id: rm.id,
          type: rm.type,
          data: rm.data||{},
          createdAt: rm.createdAt || rm.updatedAt || new Date().toISOString(),
          updatedAt: rm.updatedAt || rm.createdAt || new Date().toISOString(),
          isDefault: !!rm.isDefault
        };
      }
    }
    // Ensure only one default
    const all = Object.values(byId);
    const defaults = all.filter(m => m.isDefault);
    if (defaults.length > 1){
      // keep latest updatedAt as default
      defaults.sort((a,b)=> new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const keeper = defaults[0];
      all.forEach(m => { if (m.id !== keeper.id && m.isDefault) m.isDefault = false; });
    }
    await savePaymentMethods(all);
  } catch {}
  // Rates: we don't store locally yet (stub for future)
  // 将远端的 rates（如果存在）解析为 DISPLAY_RATES（USD/CNY/KRW/JPY）并写入本地展示比例
  try {
    if (remote.rates && Array.isArray(remote.rates) && remote.rates.length > 0) {
      // 动态 import 避免循环依赖
      const { setDisplayRates, getDisplayRates } = await import('./rates');
      const next = {};
      for (const r of remote.rates) {
        try {
          const base = (r.base || '').toString().toUpperCase();
          const quote = (r.quote || '').toString().toUpperCase();
          const val = Number(r.value);
          if (isNaN(val) || val <= 0) continue;
          // 期望后端返回的是以 "1 USDT = ? <CURRENCY>" 的形式
          // 常见情况： base = 'USDT' 或 'USD'，quote = 'USD'|'CNY'|'KRW'|'JPY'
          if (quote === 'CNY') next.CNY = val;
          else if (quote === 'KRW') next.KRW = val;
          else if (quote === 'JPY') next.JPY = val;
          else if (quote === 'USD') next.USD = val;
          // 兼容：有时后端可能使用 base/quote 反向或使用 USDT->USD/USDT->CNY 等，以上规则能覆盖常见场景
        } catch (e) { /* skip malformed */ }
      }
      if (Object.keys(next).length > 0) {
        // 合并到已有的展示比例，避免覆盖未返回的币种
        const current = await getDisplayRates();
        const merged = { ...current, ...next };
        await setDisplayRates(merged);
      }
    }
  } catch (e) { /* 非关键；继续合并其他数据 */ }

  // Platform deposit: overwrite if remote newer
  try {
    if (remote.platformDeposit) {
      const { getPlatformDepositAddress, savePlatformDepositAddress } = await import('./platformDeposit');
      const local = await getPlatformDepositAddress();
      if (!local.updatedAt || (remote.platformDeposit.updatedAt && remote.platformDeposit.updatedAt > local.updatedAt)) {
        await savePlatformDepositAddress({
          address: remote.platformDeposit.address||'',
          qrImage: remote.platformDeposit.qrImage||'',
          note: remote.platformDeposit.note||''
        });
      }
    }
  } catch {}
  return { ok:true };
}

// == 诊断 & 操作 ==
function summarize(item){
  try {
    const t = item.type;
    if (t === 'user') return `用户 ${item.data?.user?.username || ''} 元信息更新`;
    if (t === 'payment-method') {
      const pm = item.data?.paymentMethod || {};
      const def = pm.isDefault ? '（默认）' : '';
      return `支付方式 ${pm.type || ''}${def}`;
    }
    if (t === 'rate') {
      const r = item.data?.rate || {};
      return `汇率 ${r.base || ''}/${r.quote || ''}=${r.value || ''}`;
    }
    if (t === 'platform-deposit') return '平台收款配置更新';
    if (t === 'order') return '订单上报';
    if (t === 'deposit') return '充值上报';
    return t;
  } catch { return item.type; }
}

export async function getSyncDiagnostics(){
  const [q, sent] = await Promise.all([loadQueue(), loadSentLog()]);
  const nowTs = Date.now();
  const queue = q.map(it => {
    const nextAt = (it.lastTriedAt||0) + computeBackoffMs(it.retry||0);
    const scheduled = it.lastTriedAt && nowTs < nextAt;
    const status = it.retry > 0 ? (scheduled ? 'scheduled' : 'waiting') : (scheduled ? 'scheduled' : 'waiting');
    return {
      id: it.id,
      type: it.type,
      summary: summarize(it),
      retry: it.retry||0,
      createdAt: it.createdAt||0,
      lastTriedAt: it.lastTriedAt||0,
      nextAttemptAt: scheduled ? nextAt : nowTs,
      status,
    };
  });
  const history = (sent||[]).map(s => ({
    id: s.id,
    type: s.type,
    summary: summarize(s),
    sentAt: s.sentAt,
    status: 'sent',
  }));
  return { queue, history };
}

export async function discardQueueItem(id){
  const q = await loadQueue();
  const next = q.filter(it => it.id !== id);
  await saveQueue(next);
  return { ok: true };
}

export async function retryQueueItem(id){
  const q = await loadQueue();
  const idx = q.findIndex(it => it.id === id);
  if (idx === -1) return { ok:false };
  q[idx].retry = 0;
  q[idx].lastTriedAt = 0;
  // 将该项移到队列最前以优先发送
  const [item] = q.splice(idx,1);
  q.unshift(item);
  await saveQueue(q);
  try { await processQueue(); } catch {}
  return { ok:true };
}
