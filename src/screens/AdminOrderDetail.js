import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import * as Clipboard from 'expo-clipboard';
import { getCurrentUsername, isCurrentUserAdmin } from '../services/auth';
import { getOrderById, updateOrderStatus, ORDER_STATUS } from '../services/orders';
import { increaseUserBalance } from '../services/assets';
import useAdminGuard from '../hooks/useAdminGuard';
import * as log from '../services/log';

export default function AdminOrderDetail({ route, navigation }){
  const { orderId } = route.params;
  const allowed = useAdminGuard(navigation);
  const { colors, borderRadius } = useTheme();
  const { t } = useI18n();
  const [order, setOrder] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [remark, setRemark] = useState('');

  const load = async () => {
    const o = await getOrderById(orderId);
    setOrder(o);
  };
  useEffect(()=>{ const unsub = navigation.addListener('focus', load); load(); return unsub; }, [navigation, orderId]);

  if (!allowed) return null;
  if (!order) {
    return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text style={{ color:'#757575' }}>{t('loading')}</Text></View>;
  }

  const onCopy = async (text) => { try { await Clipboard.setStringAsync(text||''); Alert.alert(t('alert_title'), t('copied_success')); } catch {} };

  const approve = async () => {
    const reviewer = await getCurrentUsername();
    if (!(await isCurrentUserAdmin())) { Alert.alert(t('no_permission'), t('admin_only_access')); return; }
    Alert.alert(t('confirm'), t('confirm_approve_payout') || '确认批准打款？', [
      { text: t('cancel'), style:'cancel' },
      { text: t('confirm'), onPress: async ()=>{
        await updateOrderStatus(order.id || order._id, ORDER_STATUS.APPROVED_PAYOUT, {
          reviewerUsername: reviewer,
          reviewedAt: Date.now(),
          reviewNote: remark || '',
          payoutTxHash: txHash || '',
        });
        // 立即扣减已在下单时完成，这里不再扣减
        Alert.alert(t('submitted_title'), t('deposit_approved'));
        try { log.info('order_approved', { orderId: order.id, reviewer }); } catch {}
        load();
      }}
    ]);
  };

  const reject = async () => {
    const reviewer = await getCurrentUsername();
    if (!(await isCurrentUserAdmin())) { Alert.alert(t('no_permission'), t('admin_only_access')); return; }
    Alert.alert(t('confirm'), t('confirm_reject_payout') || '确认拒绝此订单？', [
      { text: t('cancel'), style:'cancel' },
      { text: t('confirm'), onPress: async ()=>{
        await updateOrderStatus(order.id || order._id, ORDER_STATUS.REJECTED_PAYOUT, {
          reviewerUsername: reviewer,
          reviewedAt: Date.now(),
          reviewNote: remark || '',
        });
        // 退回用户下单时扣除的 USDT
        try { await increaseUserBalance(order.creatorUsername, Number(order.amountUSDT)||0); } catch {}
        Alert.alert(t('submitted_title'), t('deposit_rejected'));
        try { log.info('order_rejected', { orderId: order.id, reviewer }); } catch {}
        load();
      }}
    ]);
  };

  const markCompleted = async () => {
    Alert.alert(t('confirm'), t('confirm_mark_completed') || '确认标记为已完成？', [
      { text: t('cancel'), style:'cancel' },
      { text: t('confirm'), onPress: async ()=>{
        await updateOrderStatus(order.id || order._id, ORDER_STATUS.COMPLETED, {
          payoutTxHash: txHash || order.payoutTxHash || '',
          completedAt: Date.now(),
        });
        Alert.alert(t('submitted_title'), t('completed'));
        load();
      }}
    ]);
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: '#F7F7F7', padding:12 }}>
      <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12 }}>
        <Text style={{ fontWeight:'700', fontSize:16 }}>{t('order_detail') || '订单详情'}</Text>
        <Text style={{ marginTop:8, color:'#424242' }}>ID: {order.id || order._id}</Text>
  <Text style={{ marginTop:4, color:'#424242' }}>{t('exchanged_amount')}: {order.amountUSDT} USDT · {t('unit_price')} ${order.unitPrice} · {t('net_receive_total')} ${order.netReceiveUSD !== undefined ? order.netReceiveUSD : (order.payTotalUSD !== undefined ? order.payTotalUSD : '-')}</Text>
        <Text style={{ marginTop:4, color:'#424242' }}>{t('created_time') || '创建时间'}: {new Date(order.createdAt).toLocaleString()}</Text>
  <Text style={{ marginTop:4, color:'#424242' }}>{t('status') || '状态'}: {t(order.status) || order.status}</Text>
      </View>

      <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>{t('payout_address') || '收款地址'}</Text>
        <Text style={{ color:'#424242' }}>{order.receiptAddress || '-'}</Text>
        {order.receiptAddress ? (
          <TouchableOpacity onPress={()=> onCopy(order.receiptAddress)} style={{ marginTop:6 }}>
            <Text style={{ color:'#1976D2' }}>{t('copy')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12, marginTop:12 }}>
  <Text>{t('tx_hash') || '打款交易哈希（可选）'}</Text>
  <TextInput value={txHash} onChangeText={setTxHash} placeholder={t('tx_hash_optional') || '(optional)'} style={{ height:44, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, marginTop:6 }} />
        <Text style={{ marginTop:12 }}>{t('review_remark')}</Text>
        <TextInput value={remark} onChangeText={setRemark} placeholder='' style={{ height:44, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, marginTop:6 }} />
        <View style={{ flexDirection:'row', gap:12, marginTop:12, flexWrap:'wrap' }}>
          <PrimaryButton title={t('approve') || '批准'} onPress={approve} />
          <PrimaryButton title={t('reject') || '拒绝'} onPress={reject} style={{ backgroundColor:'#E53935' }} />
          {order.status === ORDER_STATUS.APPROVED_PAYOUT ? (
            <PrimaryButton title={t('mark_completed') || '标记完成'} onPress={markCompleted} style={{ backgroundColor:'#2E7D32' }} />
          ) : null}
        </View>
      </View>

      {order.reviewerUsername ? (
        <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12, marginTop:12 }}>
          <Text style={{ fontWeight:'700' }}>{t('audit_info') || '审核信息'}</Text>
          <Text style={{ marginTop:6, color:'#424242' }}>{t('reviewer') || '审核人'}: {order.reviewerUsername}</Text>
          <Text style={{ marginTop:2, color:'#424242' }}>{t('created_time') || '时间'}: {order.reviewedAt ? new Date(order.reviewedAt).toLocaleString() : '-'}</Text>
          <Text style={{ marginTop:2, color:'#424242' }}>{t('review_remark')}: {order.reviewNote || '-'}</Text>
          <Text style={{ marginTop:2, color:'#424242' }}>{t('tx_hash') || '交易哈希'}: {order.payoutTxHash || '-'}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
