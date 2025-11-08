import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FAQ() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(null);

  const SECTIONS = [
    { title: t('about_upai'), content: t('about_upai_content') },
    { title: t('need_deposit'), content: t('need_deposit_content') },
    { title: t('how_to_be_agent'), content: t('how_to_be_agent_content') },
    { title: t('beware_fake'), content: t('beware_fake_content') },
  ];

  const toggle = (idx) => {
    LayoutAnimation.easeInEaseOut();
    setOpen(open === idx ? null : idx);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      {SECTIONS.map((sec, idx) => (
        <View key={idx} style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.divider }}>
          <TouchableOpacity onPress={() => toggle(idx)}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{sec.title}</Text>
          </TouchableOpacity>
          {open === idx && (
            <Text style={{ marginTop: 8, color: '#616161', lineHeight: 20 }}>{sec.content}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
