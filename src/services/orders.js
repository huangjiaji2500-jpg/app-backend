import AsyncStorage from '@react-native-async-storage/async-storage';

const ORDERS_KEY = 'LOCAL_ORDERS';

export async function listOrders() {
  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getOrderById(id) {
  const list = await listOrders();
  return list.find(o => o.id === id || o._id === id) || null;
}

export async function upsertOrder(order) {
  const list = await listOrders();
  const idx = list.findIndex(o => o.id === order.id || o._id === order.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...order };
  else list.unshift(order);
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  return order;
}

export async function updateOrderStatus(id, status, patch = {}) {
  const list = await listOrders();
  const idx = list.findIndex(o => o.id === id || o._id === id);
  if (idx < 0) return null;
  const next = { ...list[idx], status, ...patch };
  list[idx] = next;
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  return next;
}

export const ORDER_STATUS = {
  PENDING_ADMIN_REVIEW: 'pending_admin_review',
  APPROVED_PAYOUT: 'approved_payout',
  REJECTED_PAYOUT: 'rejected_payout',
  COMPLETED: 'completed',
};
