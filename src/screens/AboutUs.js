import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import Constants from 'expo-constants';
import { getRemoteBaseUrl } from '../services/cloudConfig';

export default function AboutUs() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [remoteBase, setRemoteBase] = React.useState('');
  React.useEffect(()=>{ (async ()=>{ setRemoteBase(await getRemoteBaseUrl()); })(); },[]);
  const ver = Constants?.expoConfig?.version || '1.0.0';
  return (
    <View style={{ flex:1, padding: spacing.md, backgroundColor: colors.background }}>
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontSize:18, fontWeight:'700' }}>{t('about_us')}</Text>
        <Text style={{ marginTop:8, color:'#616161' }}>{t('about_upai_content')}</Text>
        <Text style={{ marginTop:16, color:'#424242' }}>{t('version') || '版本'}: {ver}</Text>
        {remoteBase ? (
          <View style={{ marginTop:12 }}>
            <TouchableOpacity onPress={()=> Linking.openURL(`${remoteBase}/privacy`).catch(()=>{}) }>
              <Text style={{ color:'#1976D2' }}>{t('privacy_policy') || '隐私政策'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop:6 }} onPress={()=> Linking.openURL(`${remoteBase}/terms`).catch(()=>{}) }>
              <Text style={{ color:'#1976D2' }}>{t('terms_of_service') || '用户条款'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={{ marginTop:12, color:'#757575' }}>{t('compliance_links_hint') || '合规链接将在配置远端地址后显示'}</Text>
        )}
      </View>
    </View>
  );
}
