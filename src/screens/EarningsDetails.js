import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity, Modal } from 'react-native';
import PrimaryButton from '../components/ui/PrimaryButton';
import { getPaymentMethods } from '../services/paymentMethods';
import PaymentMethodPicker, { getMethodLabel } from '../components/PaymentMethodPicker';
import { getWalletAddressInfo } from '../services/assets';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import api from '../services/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function EarningsDetails() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const navigation = useNavigation();
  const [data, setData] = useState({ total: 0, withdrawable: 0, personal: 0, team: 0, today: 0 });

  const load = async () => {
    try {
      const meResp = await api.get('/users/me');
      const teamResp = await api.get('/team/stats');
      setData({
        total: meResp.data?.totalEarnings || 0,
        withdrawable: meResp.data?.withdrawable || 0,
        personal: 0, // 留做后端细分接口
        team: (teamResp.data?.totalCommission) || 0,
        today: 0,
      });
    } catch {
      setData({ total: 0, withdrawable: 0, personal: 0, team: 0, today: 0 });
    }
  };

  useEffect(() => { load(); }, []);
  useFocusEffect(React.useCallback(()=>{ loadMethods(); }, []));

  // 支付方式选择 (复用与下单页一致的写法简化) 
  const [methods, setMethods] = useState([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState(null);

  const loadMethods = async () => {
    let list = await getPaymentMethods();
    list = Array.isArray(list) ? [...list] : [];
    // 合入默认钱包地址
    try {
      const wallet = await getWalletAddressInfo();
      if (wallet && wallet.address) {
        const exists = list.some(m => m.type==='usdt_trc20' && (m.data?.address||'').trim() === wallet.address.trim());
        if (!exists) list = [{ id:'WALLET_DEFAULT', type:'usdt_trc20', data:{ address: wallet.address }, source:'wallet' }, ...list];
      }
    } catch {}
    setMethods(list);
    if (!selectedMethodId && list.length===1) setSelectedMethodId(list[0].id);
  };

  useEffect(()=>{ loadMethods(); }, []);

  const onWithdraw = async () => {
  if (data.withdrawable <= 0) { Alert.alert(t('alert_title'), t('no_withdrawable_amount') || '暂无可提现金额'); return; }
    if (!selectedMethodId) { setPickerVisible(true); return; }
    const method = methods.find(m=> m.id===selectedMethodId);
    Alert.alert(t('confirm'), t('confirm_withdraw_message') || '是否将可提现金额申请打款？', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: async () => {
        try {
          // 后端扩展字段：paymentMethodType + receipt
          const receipt = method?.data?.address || method?.data?.kakaoPhone || method?.data?.cardNumber || method?.data?.bankCardNumber || '';
          const payload = { amount: data.withdrawable };
          if (method?.type === 'usdt_trc20') {
            payload.toWalletAddress = receipt; // 兼容旧后端字段
          } else {
            payload.paymentMethodType = method?.type;
            payload.receipt = receipt;
          }
          await api.post('/payment/withdraw', payload);
          Alert.alert(t('success') || '成功', t('withdraw_submitted') || '提现申请已提交');
          load();
        } catch (e) {
          Alert.alert(t('error'), e.message || t('withdraw_failed') || '提现失败');
        }
      }}
    ]);
  };

  const renderPicker = () => (
    <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={()=> setPickerVisible(false)}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24 }}>
        <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, maxHeight:'70%' }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <Text style={{ fontSize:16, fontWeight:'700' }}>{t('choose_method')}</Text>
            <View style={{ flexDirection:'row' }}>
              <TouchableOpacity onPress={()=> { setPickerVisible(false); navigation.navigate('PaymentMethodEdit'); }} style={{ marginRight:16 }}>
                <Text style={{ color:'#1976D2' }}>+ {t('add_payment_method')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=> { setPickerVisible(false); navigation.navigate('PaymentMethodManager'); }}>
                <Text style={{ color:'#1976D2' }}>{t('manage_payment_methods')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {methods.length===0 ? (
            <Text style={{ color:'#757575' }}>{t('no_methods')}</Text>
          ) : (
            <PaymentMethodPicker methods={methods} selectedId={selectedMethodId} onSelect={(id)=> { setSelectedMethodId(id); setPickerVisible(false); }} horizontal={false} showSelectedTag={false} itemMaxWidth={260} />
          )}
          <View style={{ marginTop:12, flexDirection:'row', justifyContent:'flex-end' }}>
            <TouchableOpacity onPress={()=> setPickerVisible(false)}>
              <Text style={{ color:'#1976D2' }}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.divider }}>
  <Text style={{ color: '#757575' }}>{t('total_earnings')}</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', marginTop: 6 }}>{data.total}</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <View>
            <Text style={{ color: '#757575' }}>{t('personal_order_earnings')}</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 4 }}>{data.personal}</Text>
          </View>
          <View>
            <Text style={{ color: '#757575' }}>{t('team_commission_earnings')}</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 4 }}>{data.team}</Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={{ color: '#757575' }}>{t('today_earnings')}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 4 }}>{data.today}</Text>
        </View>

        <View style={{ marginTop: 16 }}>
           <PrimaryButton title={t('withdraw_withdrawable', { amount: data.withdrawable })} onPress={onWithdraw} />
           {selectedMethodId && (
            <Text style={{ marginTop:8, fontSize:12, color:'#616161' }}>{t('current_method_prefix')}{getMethodLabel(methods.find(m=> m.id===selectedMethodId))}</Text>
           )}
        </View>
      </View>
    </ScrollView>
  );
}
