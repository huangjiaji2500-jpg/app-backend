import AsyncStorage from '@react-native-async-storage/async-storage';

// 独立的当前用户存取，避免 team 与 auth 循环依赖
export async function getCurrentUsername() {
  return AsyncStorage.getItem('CURRENT_USERNAME');
}