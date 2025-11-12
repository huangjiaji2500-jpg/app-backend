import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { checkUsernameAvailable, registerWithUsernamePassword } from '../services/auth';
import { useI18n } from '../context/I18nContext';

export default function Register({ navigation, route }) {
  const { colors, borderRadius } = useTheme();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(route?.params?.inviteCode || '');
  const [usernameHint, setUsernameHint] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [passwordHint, setPasswordHint] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const onUsernameChange = (v) => {
    setUsername(v);
    setUsernameHint('');
    setUsernameStatus(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!/^[A-Za-z0-9_]{4,20}$/.test(v)) {
        setUsernameHint(t('username_rules_hint'));
        setUsernameStatus('error');
        return;
      }
      try {
        const ok = await checkUsernameAvailable(v);
        setUsernameHint(ok ? t('username_available') : t('username_taken'));
        setUsernameStatus(ok ? 'success' : 'error');
      } catch {}
    }, 400);
  };

  const onPasswordChange = (v) => {
    setPassword(v);
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(v)) setPasswordHint(t('password_rules_hint'));
    else setPasswordHint('');
  };

  const onSubmit = async () => {
    if (usernameStatus === 'error' && usernameHint) {
      Alert.alert(t('alert_title'), usernameHint);
      return;
    }
    if (!/^[A-Za-z0-9_]{4,20}$/.test(username)) {
      Alert.alert(t('alert_title'), t('username_invalid'));
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password)) {
      Alert.alert(t('alert_title'), t('password_invalid'));
      return;
    }

    setLoading(true);
    try {
      await registerWithUsernamePassword({ username, password, inviteCode });
      Alert.alert(t('register_success_title'), t('register_auto_login_desc'), [{ text: t('enter_home'), onPress: () => navigation.replace('MainTabs') }]);
    } catch (e) {
      Alert.alert(t('error'), e.message || t('register_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('register_title')}</Text>
      <View style={{ marginTop: 16 }}>
        <Text>{t('username_label')}</Text>
        <TextInput
          value={username}
          onChangeText={onUsernameChange}
          placeholder={t('username_placeholder')}
          autoCapitalize="none"
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
        {!!usernameHint && (
          <Text style={{ marginTop: 6, color: usernameStatus === 'success' ? '#4CAF50' : '#E53935' }}>{usernameHint}</Text>
        )}
      </View>

      <View style={{ marginTop: 12 }}>
        <Text>{t('password_label')}</Text>
        <TextInput
          value={password}
          onChangeText={onPasswordChange}
          placeholder={t('password_placeholder')}
          secureTextEntry
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
        {!!passwordHint && <Text style={{ marginTop: 6, color: '#E53935' }}>{passwordHint}</Text>}
      </View>

      <View style={{ marginTop: 12 }}>
        <Text>{t('invite_code_optional')}</Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder={t('invite_code_placeholder')}
          autoCapitalize="characters"
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton title={t('register_and_login')} onPress={onSubmit} loading={loading} />
      </View>

      <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.replace('Login')}>
        <Text style={{ color: '#1976D2' }}>{`${t('have_account')} ${t('go_login')}`}</Text>
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