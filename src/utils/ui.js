import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const tap = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
  } catch {}
};

export const success = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {}
};

export const warn = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {}
};

export const error = async () => {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {}
};