import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { tap } from '../../utils/ui';

export default function PrimaryButton({ title, onPress, disabled, loading, style }) {
  const { colors, borderRadius, fonts } = useTheme();

  const handlePress = async () => {
    if (disabled || loading) return;
    await tap();
    onPress?.();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: disabled ? colors.primaryLight : colors.primary, borderRadius: borderRadius.md },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.text, { color: '#fff', fontSize: fonts.sizes.md }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: {
    fontWeight: '600',
  },
});