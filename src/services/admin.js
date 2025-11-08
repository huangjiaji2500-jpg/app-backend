import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfiles, getCommissions } from './team';

const LOCAL_USERS_KEY = 'LOCAL_AUTH_USERS';
const LOCAL_ORDERS_KEY = 'LOCAL_ORDERS';

export async function getAllUsers() {
  const raw = await AsyncStorage.getItem(LOCAL_USERS_KEY);
  const users = raw ? JSON.parse(raw) : {};
  const profiles = await getUserProfiles();
  return Object.values(users).map(u => ({
    username: u.username,
    isAdmin: !!u.isAdmin,
    firebaseUid: u.firebaseUid,
    inviteCode: profiles[u.username]?.inviteCode || null,
    inviterCode: profiles[u.username]?.inviterCode || null,
  }));
}

export async function getAllOrders() {
  const raw = await AsyncStorage.getItem(LOCAL_ORDERS_KEY);
  const list = raw ? JSON.parse(raw) : [];
  return list;
}

export async function getAllCommissions() {
  const list = await getCommissions();
  return list;
}