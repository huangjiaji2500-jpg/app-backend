import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRemoteBaseUrl, getSyncSecret } from './cloudConfig';
import { getCurrentUsername } from './auth';
import * as Crypto from 'expo-crypto';

const QUEUE_KEY = 'REMOTE_SYNC_QUEUE_V1';
const MAX_RETRY = 5;

async function loadQueue(){
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveQueue(list){
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

function now(){ return Date.now(); }

async function signPayload(payload){
  const secret = await getSyncSecret();
  const json = JSON.stringify(payload);
  const base = `${json}|${secret||''}`;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base);
  return hash;
}

async function pushToQueue(item){
  const q = await loadQueue();
  q.push(item);
  await saveQueue(q);
}

export async function queueOrderSync(order){
  const username = await getCurrentUsername();
  await pushToQueue({ type:'order', data: { order, username }, retry:0, createdAt: now() });
  try { processQueue(); } catch {}
}

export async function queueDepositSync(deposit){
  const username = await getCurrentUsername();
  await pushToQueue({ type:'deposit', data: { deposit, username }, retry:0, createdAt: now() });
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
        const payload = { ...item.data, ts: now(), type: item.type };
        const signature = await signPayload(payload);
        const res = await fetch(`${base}/api/sync/${item.type}`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'X-Sync-Signature': signature },
          body: JSON.stringify(payload),
        });
        if (!res.ok){ throw new Error(`status_${res.status}`); }
      } catch (e){
        const retry = (item.retry||0)+1;
        if (retry < MAX_RETRY){ remaining.push({ ...item, retry }); }
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
  if (!base) return { orders:[], deposits:[] };
  const ts = Date.now();
  const secret = await getSyncSecret();
  const signature = secret ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${ts}|${secret}`) : '';
  try {
    const res = await fetch(`${base}/api/sync/list`, { headers:{ 'X-Ts': String(ts), 'X-Sync-Signature': signature } });
    if (!res.ok) throw new Error('bad_status_'+res.status);
    const json = await res.json();
    return { orders: json.orders||[], deposits: json.deposits||[] };
  } catch { return { orders:[], deposits:[] }; }
}

export async function forceRetrySync(){ return processQueue(); }

// 启动时尝试处理一次（不阻塞首屏）
setTimeout(()=>{ processQueue(); }, 3000);
