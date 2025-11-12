import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { getDisplayRates, setDisplayRates } from '../services/rates';
import { fetchRemoteLatest, mergeRemoteData } from '../services/remoteSync';
import { getRemoteBaseUrl, setRemoteBaseUrl, getSyncSecret, setSyncSecret } from '../services/cloudConfig';
import { isCurrentUserAdmin } from '../services/auth';
import useAdminGuard from '../hooks/useAdminGuard';

export default function RateSettings({ navigation }) {
  const { colors, spacing, borderRadius } = useTheme();
  // 平台系数已取消展示与编辑，仅保留平台兑换比例
  const [dispRates, setDispRates] = useState({ USD:1, CNY:11, KRW:2250, JPY:237 });
  const [usd,setUsd] = useState('');
  const [cny, setCny] = useState('');
  const [krw, setKrw] = useState('');
  const [jpy, setJpy] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [remoteBase, setRemoteBase] = useState('');
  const [remoteBaseInput, setRemoteBaseInput] = useState('');
  const [syncSecretInput, setSyncSecretInput] = useState('');

  const allowed = useAdminGuard(navigation);

  useEffect(() => { (async () => {
    setIsAdmin(await isCurrentUserAdmin());
    setDispRates(await getDisplayRates());
    try { setRemoteBase(await getRemoteBaseUrl()); } catch {}
    try { const s = await getSyncSecret(); if (s) setSyncSecretInput(s); } catch {}
  })(); }, []);

  // 平台系数保存已移除

  const onSaveDisplay = async () => {
    try {
      const payload = {};
      if (usd) payload.USD = Number(usd);
      if (cny) payload.CNY = Number(cny);
      if (krw) payload.KRW = Number(krw);
      if (jpy) payload.JPY = Number(jpy);
      if (Object.keys(payload).length === 0) { Alert.alert('无改动','请输入要更新的基础汇率'); return; }
      const next = await setDisplayRates(payload);
      setDispRates(next);
      setUsd(''); setCny(''); setKrw(''); setJpy('');
      Alert.alert('成功','平台兑换比例已更新');
    } catch (e) {
      Alert.alert('失败', e.message || '更新失败');
    }
  };

  const onPullRemote = async () => {
    try {
      const base = await getRemoteBaseUrl();
      if (!base) { Alert.alert('未配置远端地址', '请先填写并保存 Remote Base URL'); return; }
      const remote = await fetchRemoteLatest();
      // 给出更详细的调试信息，帮助定位为何没有 rates
      if (!remote) { Alert.alert('失败', '拉取出错：未返回数据'); return; }
      const cnt = Array.isArray(remote.rates) ? remote.rates.length : 0;
      if (cnt === 0) {
        Alert.alert('无汇率', '远端未返回任何汇率（rates 数组为空）');
        return;
      }
      await mergeRemoteData(remote);
      const updated = await getDisplayRates();
      setDispRates(updated);
      Alert.alert('成功', `已从后台拉取 ${cnt} 条汇率并更新本地展示比例`);
    } catch (e) {
      Alert.alert('失败', e.message || '拉取失败');
    }
  };

  const onSaveRemoteBase = async () => {
    try {
      await setRemoteBaseUrl(remoteBaseInput || '');
      setRemoteBase(remoteBaseInput || '');
      Alert.alert('保存', 'Remote Base URL 已保存');
    } catch (e) { Alert.alert('失败', e.message || '保存失败'); }
  };

  const onSaveSyncSecret = async () => {
    try {
      await setSyncSecret(syncSecretInput || '');
      Alert.alert('保存', 'Sync Secret 已保存');
    } catch (e) { Alert.alert('失败', e.message || '保存失败'); }
  };

  // 定价影响开关已被产品要求隐藏并固定关闭，这里不再暴露 UI。

  if (!allowed) return null;
  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontSize:18, fontWeight:'700' }}>平台兑换比例 (1 USDT = ?)</Text>
        <Text style={{ marginTop:8, color:'#616161' }}>用于“本地币显示/利润估算/单位展示”，不影响商家单价内部结算逻辑。</Text>
        {/* 对照当前比例的 Banner */}
        <View style={{ marginTop:8 }}>
        </View>
        <View style={{ marginTop:12 }}>
          <Text style={{ color:'#424242' }}>当前：USD {dispRates.USD} · CNY {dispRates.CNY} · KRW {dispRates.KRW} · JPY {dispRates.JPY}</Text>
        </View>
        {isAdmin ? (
          <View style={{ marginTop:12 }}>
            <Text style={{ marginBottom:6 }}>USDT→USD</Text>
            <TextInput value={usd} onChangeText={setUsd} placeholder={`当前 ${dispRates.USD}`} keyboardType="numeric" style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, height:44, paddingHorizontal:12, backgroundColor:'#fff' }} />
            <Text style={{ marginTop:10, marginBottom:6 }}>USDT→CNY</Text>
            <TextInput value={cny} onChangeText={setCny} placeholder={`当前 ${dispRates.CNY}`} keyboardType="numeric" style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, height:44, paddingHorizontal:12, backgroundColor:'#fff' }} />
            <Text style={{ marginTop:10, marginBottom:6 }}>USDT→KRW</Text>
            <TextInput value={krw} onChangeText={setKrw} placeholder={`当前 ${dispRates.KRW}`} keyboardType="numeric" style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, height:44, paddingHorizontal:12, backgroundColor:'#fff' }} />
            <Text style={{ marginTop:10, marginBottom:6 }}>USDT→JPY</Text>
            <TextInput value={jpy} onChangeText={setJpy} placeholder={`当前 ${dispRates.JPY}`} keyboardType="numeric" style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, height:44, paddingHorizontal:12, backgroundColor:'#fff' }} />
            <PrimaryButton title="保存兑换比例" onPress={onSaveDisplay} style={{ marginTop:12 }} />
            <PrimaryButton title="从后台拉取汇率" onPress={onPullRemote} style={{ marginTop:8, backgroundColor:'#eef' }} />
            <View style={{ marginTop:12 }}>
              <Text style={{ marginBottom:6 }}>Remote Base URL (例如 https://example.com)</Text>
              <TextInput value={remoteBaseInput} onChangeText={setRemoteBaseInput} placeholder={`当前 ${remoteBase || '未设置'}`} keyboardType="default" style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, height:44, paddingHorizontal:12, backgroundColor:'#fff' }} />
              <PrimaryButton title="保存 Remote Base URL" onPress={onSaveRemoteBase} style={{ marginTop:8 }} />
              <Text style={{ marginTop:10, marginBottom:6 }}>Sync Secret (签名密钥)</Text>
              <TextInput value={syncSecretInput} onChangeText={setSyncSecretInput} placeholder={`当前 ${syncSecretInput ? '已设置' : '未设置'}`} keyboardType="default" style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, height:44, paddingHorizontal:12, backgroundColor:'#fff' }} />
              <PrimaryButton title="保存 Sync Secret" onPress={onSaveSyncSecret} style={{ marginTop:8 }} />
            </View>
          </View>
        ) : (
          <Text style={{ marginTop:12, color:'#999' }}>仅管理员可调整。</Text>
        )}
      </View>
    </ScrollView>
  );
}
