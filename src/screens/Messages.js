import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

export default function Messages() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex:1, padding: spacing.md, backgroundColor: colors.background }}>
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontSize:18, fontWeight:'700' }}>{t('messages_placeholder_title') || '我的消息 (占位)'}</Text>
        <Text style={{ marginTop:8, color:'#616161' }}>{t('messages_empty_desc') || '暂无消息。后续将展示系统通知、订单提醒与活动推送。'}</Text>
      </View>
    </View>
  );
}
