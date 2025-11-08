import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ContactUs() {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={{ flex:1, padding: spacing.md, backgroundColor: colors.background }}>
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontSize:18, fontWeight:'700' }}>联系我们 (占位)</Text>
        <Text style={{ marginTop:8, color:'#616161' }}>后续提供客服邮箱 / 在线工单 / Telegram 群等渠道。</Text>
      </View>
    </View>
  );
}
