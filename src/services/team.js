import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUsername } from './currentUser';

// Keys
const KEY_USER_PROFILES = 'USER_PROFILES'; // { [username]: { inviteCode, inviterCode|null } }
const KEY_CODE_TO_USER = 'INVITE_CODE_TO_USER'; // { [inviteCode]: username }
const KEY_RELATIONS = 'INVITATION_RELATIONS'; // { [inviteCode]: string[] usernames (direct children) }
const KEY_COMMISSIONS = 'TEAM_COMMISSIONS'; // Array<{ id, toUsername, level:1|2|3, amountUSDT, fromUsername, orderId, createdAt }>

async function getJSON(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : (fallback ?? null);
}

async function setJSON(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getUserProfiles() { return (await getJSON(KEY_USER_PROFILES, {})) || {}; }
export async function getInviteCodeToUser() { return (await getJSON(KEY_CODE_TO_USER, {})) || {}; }
export async function getRelations() { return (await getJSON(KEY_RELATIONS, {})) || {}; }
export async function getCommissions() { return (await getJSON(KEY_COMMISSIONS, [])) || []; }

function random3() { return Math.floor(100 + Math.random() * 900); }

export async function ensureUserProfile(username) {
  const profiles = await getUserProfiles();
  const codeToUser = await getInviteCodeToUser();
  if (profiles[username]?.inviteCode) return profiles[username];
  // generate unique code: username-xyz
  let code;
  let attempts = 0;
  do {
    code = `${username}-${random3()}`;
    attempts++;
  } while (codeToUser[code] && attempts < 10);
  profiles[username] = { inviteCode: code, inviterCode: profiles[username]?.inviterCode || null };
  codeToUser[code] = username;
  await setJSON(KEY_USER_PROFILES, profiles);
  await setJSON(KEY_CODE_TO_USER, codeToUser);
  return profiles[username];
}

export async function setInviterByInviteCode(username, inviterCode) {
  if (!inviterCode) return null;
  const profiles = await getUserProfiles();
  const codeToUser = await getInviteCodeToUser();
  const relations = await getRelations();
  // validate inviterCode exists
  const inviterUsername = codeToUser[inviterCode];
  if (!inviterUsername) return null;
  // set inviter
  profiles[username] = profiles[username] || { inviteCode: null, inviterCode: null };
  profiles[username].inviterCode = inviterCode;
  // push relation
  relations[inviterCode] = relations[inviterCode] || [];
  if (!relations[inviterCode].includes(username)) relations[inviterCode].push(username);
  await setJSON(KEY_USER_PROFILES, profiles);
  await setJSON(KEY_RELATIONS, relations);
  return inviterUsername;
}

export async function getUserProfile(username) {
  const profiles = await getUserProfiles();
  return profiles[username] || null;
}

export async function getUplineCodes(username) {
  const profiles = await getUserProfiles();
  const codeToUser = await getInviteCodeToUser();
  const me = profiles[username];
  const lvl1 = me?.inviterCode || null;
  const lvl2 = lvl1 ? (profiles[codeToUser[lvl1]]?.inviterCode || null) : null;
  const lvl3 = lvl2 ? (profiles[codeToUser[lvl2]]?.inviterCode || null) : null;
  return [lvl1, lvl2, lvl3];
}

export async function distributeCommissionsForOrder({ fromUsername, orderId, amountUSDT }) {
  const [lvl1, lvl2, lvl3] = await getUplineCodes(fromUsername);
  const codeToUser = await getInviteCodeToUser();
  const commissions = await getCommissions();
  const now = new Date().toISOString();
  const grants = [];
  if (lvl1) grants.push({ toUsername: codeToUser[lvl1], level: 1, amountUSDT: amountUSDT * 0.30 });
  if (lvl2) grants.push({ toUsername: codeToUser[lvl2], level: 2, amountUSDT: amountUSDT * 0.15 });
  if (lvl3) grants.push({ toUsername: codeToUser[lvl3], level: 3, amountUSDT: amountUSDT * 0.05 });
  for (const g of grants) {
    const id = `${orderId}_${g.toUsername}_${g.level}`;
    if (!commissions.find(c => c.id === id)) {
      commissions.unshift({ id, toUsername: g.toUsername, level: g.level, amountUSDT: Number(g.amountUSDT.toFixed(6)), fromUsername, orderId, createdAt: now });
    }
  }
  await setJSON(KEY_COMMISSIONS, commissions);
  return grants;
}

export async function getCommissionTotalsByLevel(forUsername) {
  const commissions = await getCommissions();
  const my = commissions.filter(c => c.toUsername === forUsername);
  const totals = { total: 0, l1: 0, l2: 0, l3: 0, recent: [] };
  for (const c of my) {
    totals.total += c.amountUSDT;
    if (c.level === 1) totals.l1 += c.amountUSDT;
    if (c.level === 2) totals.l2 += c.amountUSDT;
    if (c.level === 3) totals.l3 += c.amountUSDT;
  }
  totals.recent = my.slice(0, 3);
  return totals;
}

export async function computeTeamHierarchy(forUsername) {
  const profiles = await getUserProfiles();
  const codeToUser = await getInviteCodeToUser();
  const relations = await getRelations();
  const me = profiles[forUsername];
  const myCode = me?.inviteCode;
  const lvl1Users = (myCode && relations[myCode]) ? relations[myCode] : [];
  // Level 2: direct children of level1 users
  let lvl2Users = [];
  for (const u1 of lvl1Users) {
    const code = profiles[u1]?.inviteCode;
    if (code && relations[code]) lvl2Users = lvl2Users.concat(relations[code]);
  }
  // Level 3
  let lvl3Users = [];
  for (const u2 of lvl2Users) {
    const code = profiles[u2]?.inviteCode;
    if (code && relations[code]) lvl3Users = lvl3Users.concat(relations[code]);
  }

  // Commission totals by level for me
  const totals = await getCommissionTotalsByLevel(forUsername);
  return {
    level1Count: lvl1Users.length,
    level2Count: lvl2Users.length,
    level3Count: lvl3Users.length,
    totalMembers: lvl1Users.length + lvl2Users.length + lvl3Users.length,
    level1Commission: Number(totals.l1.toFixed(6)),
    level2Commission: Number(totals.l2.toFixed(6)),
    level3Commission: Number(totals.l3.toFixed(6)),
    totalCommission: Number(totals.total.toFixed(6)),
    recent: totals.recent,
  };
}

export async function getMyInviteCode() {
  const username = await getCurrentUsername();
  if (!username) return '';
  const p = await ensureUserProfile(username);
  return p.inviteCode;
}

export async function registerInvitationIfAny({ username, inviteCode }) {
  // Ensure my own invite code exists first
  await ensureUserProfile(username);
  if (inviteCode) await setInviterByInviteCode(username, inviteCode);
}
