import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function SegmentTabs({ tabs = [], value, onChange }) {
  const { colors, borderRadius, spacing } = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: colors.border, borderRadius: borderRadius.lg }]}> 
      {/* Use horizontal ScrollView so long localized labels (e.g. Korean) don't wrap/overlap */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row' }}>
        {tabs.map((tab) => {
          const active = value === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.tabInline,
                active && { backgroundColor: colors.primary, borderRadius: borderRadius.lg },
              ]}
              onPress={() => onChange?.(tab.value)}
              activeOpacity={0.8}
            >
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: active ? '#fff' : colors.text.primary, fontWeight: '600', paddingHorizontal:8 }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 2,
  },
  tabInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    minWidth: 72,
  },
});