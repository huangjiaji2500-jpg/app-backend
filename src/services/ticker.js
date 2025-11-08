// 简易本地事件推送供跑马灯使用
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pushTicker(message) {
  for (const fn of listeners) {
    try { fn(message); } catch {}
  }
}
