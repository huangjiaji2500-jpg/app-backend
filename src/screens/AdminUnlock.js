import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import PrimaryButton from '../components/ui/PrimaryButton';
import { anyAdminExists, promoteCurrentUserToAdmin } from '../services/auth';
import { useTheme } from '../context/ThemeContext';

export default function AdminUnlock({ navigation }) {
  const { colors, borderRadius } = useTheme();
  const [hasAdmin, setHasAdmin] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { (async ()=> setHasAdmin(await anyAdminExists()))(); }, []);

  const onSubmit = async () => {
    setError('');
    try {
      const res = await promoteCurrentUserToAdmin({ code });
      if (res.ok) {
        Alert.alert('成功', '已升级为管理员');
        navigation.goBack();
      }
    } catch (e) {
      setError(e.message || '升级失败');
    }
  };

  return (
    <View style={{ flex:1, padding:16 }}>
      {!hasAdmin ? (
        <View>
          <Text style={{ fontSize:16, fontWeight:'700' }}>成为首位管理员</Text>
          <Text style={{ color:'#666', marginTop:8 }}>系统当前没有管理员，点击下方按钮即可将当前账号升级为管理员。</Text>
          <PrimaryButton title="一键升级为管理员" onPress={onSubmit} style={{ marginTop:16 }} />
          {error ? <Text style={{ color:'#D32F2F', marginTop:8 }}>{error}</Text> : null}
        </View>
      ) : (
        <View>
          <Text style={{ fontSize:16, fontWeight:'700' }}>管理员解锁</Text>
          <Text style={{ color:'#666', marginTop:8 }}>请输入解锁码，将当前账号升级为管理员。</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="请输入解锁码"
            style={{ borderWidth:1, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor:'#fff', height:44, paddingHorizontal:12, marginTop:12 }}
          />
          <PrimaryButton title="使用解锁码升级" onPress={onSubmit} style={{ marginTop:16 }} />
          <Text style={{ color:'#999', marginTop:8, fontSize:12 }}>演示环境默认解锁码：usdtapp-admin-001（请上线后改成后端校验）</Text>
          {error ? <Text style={{ color:'#D32F2F', marginTop:8 }}>{error}</Text> : null}
        </View>
      )}
    </View>
  );
}