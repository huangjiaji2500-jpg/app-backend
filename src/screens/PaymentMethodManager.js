import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { getPaymentMethods, removePaymentMethod, getDisplayName } from '../services/paymentMethods';

export default function PaymentMethodManager({ navigation }) {
  const { colors, borderRadius, spacing } = useTheme();
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const all = await getPaymentMethods(); setList(all); } catch { setList([]); } finally { setLoading(false); }
  };
  useEffect(()=>{ const unsub = navigation.addListener('focus', load); load(); return unsub; }, [navigation]);

  const onDelete = async (id) => {
    Alert.alert(t('confirm') || '确认', t('confirm_delete_method') || '确认删除该支付方式？', [
      { text: t('cancel') || '取消', style:'cancel' },
      { text: t('delete') || '删除', style:'destructive', onPress: async ()=>{ await removePaymentMethod(id); await load(); }}
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={{ marginBottom:12, backgroundColor:'#fff', borderRadius:borderRadius.md, borderWidth:1, borderColor:colors.divider, padding:12 }}>
      <Text style={{ fontWeight:'700' }}>{getDisplayName(item, t)}</Text>
      <View style={{ flexDirection:'row', marginTop:8 }}>
        <TouchableOpacity onPress={()=> navigation.navigate('PaymentMethodEdit', { id: item.id })} style={{ marginRight:16 }}>
          <Text style={{ color: colors.primary }}>{t('edit') || '编辑'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=> onDelete(item.id)}>
          <Text style={{ color:'#D32F2F' }}>{t('delete') || '删除'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={{ fontSize:18, fontWeight:'700', marginBottom:12 }}>{t('manage_payment_methods') || '支付方式管理'}</Text>
      <PrimaryButton title={t('add_payment_method') || '添加支付方式'} onPress={()=> navigation.navigate('PaymentMethodEdit')} />
      <View style={{ height:12 }} />
      {/* 使用与安全提示 */}
      <View style={{ backgroundColor:'#FFF', borderRadius:borderRadius.md, padding:12, borderWidth:1, borderColor:colors.divider, marginBottom:16 }}>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>{t('pm_tips_title') || '使用与安全提示'}</Text>
        <Text style={{ fontSize:12, lineHeight:18, color:'#616161' }}>{t('pm_tips_body')}</Text>
      </View>
      {loading ? <Text style={{ color:'#757575' }}>{t('loading') || '加载中...'}</Text> : null}
      <FlatList data={list} keyExtractor={i=>i.id} renderItem={renderItem} ListEmptyComponent={!loading ? <Text style={{ color:'#757575' }}>{t('no_methods') || '暂无支付方式'}</Text> : null} scrollEnabled={false} />
    </ScrollView>
  );
}
