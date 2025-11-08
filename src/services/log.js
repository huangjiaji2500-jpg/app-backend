// 关键动作最简日志（本地 console，可扩展远端）
import { getCurrentUsername } from './auth';

function stamp(){ return new Date().toISOString(); }

export async function info(event, payload={}){
  const user = await getCurrentUsername();
  // 仅本地打印，避免外传
  // eslint-disable-next-line no-console
  console.log(`[INFO] ${stamp()} ${event}`, { user, ...payload });
}

export async function warn(event, payload={}){
  const user = await getCurrentUsername();
  // eslint-disable-next-line no-console
  console.warn(`[WARN] ${stamp()} ${event}`, { user, ...payload });
}

export async function error(event, payload={}){
  const user = await getCurrentUsername();
  // eslint-disable-next-line no-console
  console.error(`[ERROR] ${stamp()} ${event}`, { user, ...payload });
}
