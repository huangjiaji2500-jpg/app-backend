import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';

export default function LanguageSettings() {
  const { currentLanguage, availableLanguages, changeLanguage } = useI18n();
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <View style={{ flex:1, backgroundColor: colors.background, padding: spacing.md }}>
      {availableLanguages.map((lang) => {
        const active = lang.code === currentLanguage;
        return (
          <TouchableOpacity
            key={lang.code}
            onPress={() => changeLanguage(lang.code)}
            style={[styles.item, { borderColor: colors.divider, borderRadius: borderRadius.lg, backgroundColor:'#fff' }]}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize:16, fontWeight:'600' }}>{lang.nativeName} ({lang.name})</Text>
            <Text style={{ color: active? '#1976D2':'#9E9E9E' }}>{active ? '✓ 已选择' : '未选择'}</Text>
          </TouchableOpacity>
        );
      })}
      <Text style={{ marginTop:8, color:'#9E9E9E', fontSize:12 }}>语言切换将立即生效，并保存在本机。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
