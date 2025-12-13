import React, { useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { loginWithUsernamePassword } from '../services/auth';
import { useI18n } from '../context/I18nContext';

export default function Login({ navigation }) {
  const { colors, borderRadius } = useTheme();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!/^[A-Za-z0-9_]{4,20}$/.test(username)) {
      Alert.alert(t('alert_title') || '提示', t('username_invalid') || '用户名格式不正确');
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password)) {
      Alert.alert(t('alert_title') || '提示', t('password_invalid') || '密码需≥6位，含字母+数字');
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithUsernamePassword({ username, password });
      if (res?.mustChangePassword) {
        Alert.alert(t('alert_title'), t('must_change_password_note') || '密码已被管理员重置，请先修改。');
        navigation.replace('ForcePasswordChange');
      } else {
        navigation.replace('MainTabs');
      }
    } catch (e) {
      // 记录详细错误供开发排查，但根据错误类型向用户显示更友好的信息（国际化）
      try { console.error('[Login] authentication error', e && (e.stack || e.message)); } catch (logErr) {}
      const msg = (e && e.message) ? String(e.message) : '';
      // 当为密码/用户相关错误时，直接提示凭证错误；其他情况显示通用升级/联系管理员提示
      if (/密码|用户不存在|不匹配|凭证/.test(msg)) {
        Alert.alert(t('login_failed') || '登录失败', t('login_failed_desc') || '请检查用户名或密码');
      } else {
        Alert.alert(t('login_failed') || '登录失败', t('login_failed_generic') || '登录失败啦～可能是应用版本太旧，麻烦更新到最新版 APP；如果更新后还是不行，联系管理员协助处理哦～');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('login_title') || '登录'}</Text>
      <View style={{ marginTop: 16 }}>
        <Text>{t('username_label') || '用户名'}</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder={t('username_placeholder') || '4-20位，仅字母数字下划线'}
          autoCapitalize="none"
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
      </View>

      <View style={{ marginTop: 12 }}>
        <Text>{t('password_label') || '密码'}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('password_placeholder') || '至少6位，含字母+数字'}
          placeholderTextColor="#9E9E9E"
          secureTextEntry={true}
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md, color: colors.text }]}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton title={t('login_btn') || '登录'} onPress={onSubmit} loading={loading} />
      </View>

      <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.replace('Register')}>
        <Text style={{ color: '#1976D2' }}>{t('no_account') || '还没有账号？'} {t('go_register') || '去注册'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    backgroundColor: '#fff',
    height: 44,
    paddingHorizontal: 12,
    marginTop: 6,
  },
});