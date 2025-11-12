import React, { useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useI18n } from '../context/I18nContext';
import { changePasswordAfterReset } from '../services/auth';

export default function ForcePasswordChange({ navigation }) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (pwd !== pwd2) { Alert.alert(t('alert_title'), t('password_mismatch') || '两次输入不一致'); return; }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(pwd)) { Alert.alert(t('alert_title'), t('password_invalid') || '密码需≥6位，含字母+数字'); return; }
    setLoading(true);
    try {
      await changePasswordAfterReset({ newPassword: pwd });
      Alert.alert(t('password_change_success') || '密码已更新', '', [{ text: t('enter_home') || '进入首页', onPress: ()=> navigation.replace('MainTabs') }]);
    } catch (e) {
      Alert.alert(t('error'), e.message || (t('password_change_failed')||'更新失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontSize:18, fontWeight:'700' }}>{t('force_change_password_title') || '修改临时密码'}</Text>
        <Text style={{ marginTop:8, color:'#616161', fontSize:12 }}>{t('force_change_password_desc') || '当前账户密码已被重置，请设置一个新的正式密码后才能继续使用。'}</Text>
        <Text style={{ marginTop:16 }}>{t('new_password_label') || '新密码'}</Text>
        <TextInput
          value={pwd}
          onChangeText={setPwd}
          secureTextEntry
          placeholder={t('password_placeholder') || '至少6位，含字母+数字'}
          style={{ marginTop:6, height:44, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:12, backgroundColor:'#FAFAFA' }}
        />
        <Text style={{ marginTop:16 }}>{t('confirm_new_password_label') || '确认新密码'}</Text>
        <TextInput
          value={pwd2}
          onChangeText={setPwd2}
          secureTextEntry
          placeholder={t('password_placeholder') || '至少6位，含字母+数字'}
          style={{ marginTop:6, height:44, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:12, backgroundColor:'#FAFAFA' }}
        />
        <PrimaryButton title={t('save') || '保存'} onPress={onSubmit} loading={loading} style={{ marginTop:20 }} />
      </View>
    </ScrollView>
  );
}