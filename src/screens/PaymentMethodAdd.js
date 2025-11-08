import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, FlatList } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { addPaymentMethod, getPaymentMethods, removePaymentMethod, validateMethod } from '../services/paymentMethods';

export default function PaymentMethodAdd(){
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [type] = useState('usdt_trc20'); // 仅保留 USDT TRC20
  const [list, setList] = useState([]);
  const [data, setData] = useState({ cardNumber:'', cardHolder:'', expiry:'', address:'' });

  const load = async () => {
    const all = await getPaymentMethods();
    setList(all.filter(i => i.type === 'usdt_trc20'));
  };
  useEffect(()=>{ load(); },[]);

  const onSubmit = async () => {
    const err = validateMethod({ type, data });
    if (err) { Alert.alert(t('alert_title'), t(err) || err); return; }
    const payload = { type, data };
    await addPaymentMethod(payload);
    await load();
    Alert.alert(t('submit_success') || '已保存');
  };

  const renderExisting = ({ item }) => (
    <View style={{ padding:12, borderWidth:1, borderColor:colors.divider, borderRadius:12, backgroundColor:'#fff', marginBottom:8 }}>
      <Text style={{ fontWeight:'700' }}>{t('method_usdt_trc20')}</Text>
      <Text style={{ marginTop:4, color:'#616161' }}>{item.data?.address}</Text>
      <TouchableOpacity onPress={async ()=>{ await removePaymentMethod(item.id); await load(); }} style={{ marginTop:8 }}>
        <Text style={{ color:'#D32F2F' }}>{t('delete') || '删除'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:colors.background, padding: spacing.md }}>
      <Text style={{ fontWeight:'700', marginBottom:8 }}>{t('add_payment_method') || '添加收款方式'}</Text>

      {/* 已有的方式 */}
      <FlatList data={list} keyExtractor={(i)=>i.id} renderItem={renderExisting} ListEmptyComponent={<Text style={{ color:'#757575' }}>{t('no_methods') || '暂无收款方式'}</Text>} />

      {/* 表单：仅 USDT TRC20 */}
      <View style={{ marginTop:12, backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:colors.divider, padding:12 }}>
        <Text>{t('usdt_address') || 'USDT地址(TRC20)'}</Text>
        <TextInput value={data.address} onChangeText={(v)=> setData(prev=>({ ...prev, address:v }))} placeholder="T... (TRON)" autoCapitalize="none" style={{ height:44, borderWidth:1, borderColor:colors.border, borderRadius:8, paddingHorizontal:10, marginTop:6 }} />
      </View>

      <View style={{ marginTop:12 }}>
        <PrimaryButton title={t('save_method') || '保存'} onPress={onSubmit} />
      </View>
    </View>
  );
}
