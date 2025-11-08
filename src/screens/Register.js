import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { checkUsernameAvailable, registerWithUsernamePassword } from '../services/auth';

export default function Register({ navigation, route }) {
  const { colors, borderRadius } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(route?.params?.inviteCode || '');
  const [usernameHint, setUsernameHint] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const onUsernameChange = (v) => {
    setUsername(v);
    setUsernameHint('');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!/^[A-Za-z0-9_]{4,20}$/.test(v)) {
        setUsernameHint('仅字母/数字/下划线，4-20位');
        return;
      }
      try {
        const ok = await checkUsernameAvailable(v);
        setUsernameHint(ok ? '用户名可用' : '用户名已被占用');
      } catch {}
    }, 400);
  };

  const onPasswordChange = (v) => {
    setPassword(v);
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(v)) setPasswordHint('密码需≥6位，含字母+数字');
    else setPasswordHint('');
  };

  const onSubmit = async () => {
    if (usernameHint === '用户名已被占用') {
      Alert.alert('提示', '用户名已被占用');
      return;
    }
    if (!/^[A-Za-z0-9_]{4,20}$/.test(username)) {
      Alert.alert('提示', '用户名格式不正确');
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password)) {
      Alert.alert('提示', '密码需≥6位，含字母+数字');
      return;
    }

    setLoading(true);
    try {
      await registerWithUsernamePassword({ username, password, inviteCode });
      Alert.alert('注册成功', '已自动登录', [{ text: '进入首页', onPress: () => navigation.replace('MainTabs') }]);
    } catch (e) {
      Alert.alert('失败', e.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>注册</Text>
      <View style={{ marginTop: 16 }}>
        <Text>用户名</Text>
        <TextInput
          value={username}
          onChangeText={onUsernameChange}
          placeholder="4-20位，仅字母数字下划线"
          autoCapitalize="none"
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
        {!!usernameHint && <Text style={{ marginTop: 6, color: usernameHint.includes('可用') ? '#4CAF50' : '#E53935' }}>{usernameHint}</Text>}
      </View>

      <View style={{ marginTop: 12 }}>
        <Text>密码</Text>
        <TextInput
          value={password}
          onChangeText={onPasswordChange}
          placeholder="至少6位，含字母+数字"
          secureTextEntry
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
        {!!passwordHint && <Text style={{ marginTop: 6, color: '#E53935' }}>{passwordHint}</Text>}
      </View>

      <View style={{ marginTop: 12 }}>
        <Text>邀请码（选填）</Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="没有可留空"
          autoCapitalize="characters"
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton title="注册并登录" onPress={onSubmit} loading={loading} />
      </View>

      <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.replace('Login')}>
        <Text style={{ color: '#1976D2' }}>已经有账号？去登录</Text>
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