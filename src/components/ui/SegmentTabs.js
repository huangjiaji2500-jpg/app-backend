import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function SegmentTabs({ tabs = [], value, onChange }) {
  const { colors, borderRadius, spacing } = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: colors.border, borderRadius: borderRadius.lg }]}>
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <TouchableOpacity
            key={tab.value}
            style={[
              styles.tab,
              active && { backgroundColor: colors.primary, borderRadius: borderRadius.lg },
            ]}
            onPress={() => onChange?.(tab.value)}
            activeOpacity={0.8}
          >
            <Text style={{ color: active ? '#fff' : colors.text.primary, fontWeight: '600' }}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});