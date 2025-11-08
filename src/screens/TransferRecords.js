import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function TransferRecords() {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={{ flex:1, padding: spacing.md, backgroundColor: colors.background }}>
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontSize:18, fontWeight:'700' }}>转账记录 (占位)</Text>
        <Text style={{ marginTop:8, color:'#616161' }}>后续展示站内转账流水与详情。</Text>
      </View>
    </View>
  );
}
