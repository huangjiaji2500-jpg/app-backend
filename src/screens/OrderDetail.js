import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import PrimaryButton from '../components/ui/PrimaryButton';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletAddressInfo, getAssetSnapshot } from '../services/assets';
import { distributeCommissionsForOrder } from '../services/team';
import { getLocalCurrencyByLang, formatLocalCurrency, toLocalFromUSD_v2 } from '../services/rates';
import { useI18n } from '../context/I18nContext';
import { getCurrentUsername } from '../services/auth';

export default function OrderDetail({ route, navigation }) {
  const { t, currentLanguage } = useI18n();
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      // 本地读取
      const raw = await AsyncStorage.getItem('LOCAL_ORDERS');
      const list = raw ? JSON.parse(raw) : [];
      const found = list.find(o => o._id === orderId || o.id === orderId);
      setOrder(found || null);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orderId]);

  const changeStatus = async (next) => {
    Alert.alert(t('confirm'), t('confirm_update_order_status', { status: t(next) }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: async () => {
        try {
          const raw = await AsyncStorage.getItem('LOCAL_ORDERS');
          const list = raw ? JSON.parse(raw) : [];
          const idx = list.findIndex(o => o._id === orderId || o.id === orderId);
          if (idx >= 0) {
            list[idx].status = next;
            await AsyncStorage.setItem('LOCAL_ORDERS', JSON.stringify(list));
          }
          // 若状态变更为已完成，资产联动更新（即时反映在个人中心）
          if (next === 'completed') {
            // 分发三级返佣
            const finished = (idx>=0? list[idx] : order) || {};
            const u = finished.creatorUsername || (await getCurrentUsername());
            const amountUSDT = Number(finished.amountUSDT) || 0;
            await distributeCommissionsForOrder({ fromUsername: u || 'unknown', orderId, amountUSDT });
            // 资产快照重新计算（个人中心会从订单与佣金汇总）
            await getAssetSnapshot();
          }
          Alert.alert(t('success'), t('order_status_updated'));
          load();
        } catch (e) {
          Alert.alert(t('error'), e.message || t('update_failed'));
        }
      }}
    ]);
  };

  const submitWithdraw = async () => {
    const wallet = await getWalletAddressInfo();
    if (wallet.status !== 'approved') {
      Alert.alert(t('cannot_submit'), t('withdraw_need_address_approved'));
      return;
    }
    Alert.alert(t('confirm_submit_withdraw_request'), t('cannot_undo'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: () => Alert.alert(t('demo'), t('withdraw_demo_notice')) }
    ]);
  };

  // 注意：Hooks 需保持固定顺序，以下 state/effect 不能放在条件返回之后
  const localCurrency = getLocalCurrencyByLang(currentLanguage);
  const netUSD = (order && order.netReceiveUSD !== undefined)
    ? Number(order.netReceiveUSD)
    : ((order && order.payTotalUSD !== undefined) ? Number(order.payTotalUSD) : 0);
  const [netLocalStr, setNetLocalStr] = useState('');
  useEffect(()=>{ (async ()=>{
    try {
      const local = await toLocalFromUSD_v2(netUSD || 0, currentLanguage);
      setNetLocalStr(formatLocalCurrency(local, localCurrency));
    } catch {
      setNetLocalStr(formatLocalCurrency(0, localCurrency));
    }
  })(); }, [order, currentLanguage]);

  if (!order) {
    return (
      <View style={styles.wrap}> 
        <Text style={{ color: '#999' }}>{loading ? t('loading') : t('order_not_found')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
  <Text style={styles.title}>{t('order_detail')||'订单详情'}</Text>
  <Text style={styles.row}>{t('order_id_label')||'订单号'}: {order._id || order.id}</Text>
  <Text style={styles.row}>{t('status')||'状态'}: {t(order.status)||order.status}</Text>
  {/* 已按规范去除原金额汇总行（金額: USDT X · 单价 · 付款总额） */}
      {/* 统一到 MyOrders 的四行规范 */}
      <Text style={styles.row}>{t('exchanged_amount')}: {order.amountUSDT} USDT</Text>
      <Text style={styles.row}>{t('service_fee_percent',{percent: (order.serviceFeeRate??0.02)*100})}</Text>
      <Text style={styles.row}>{t('grabbing_fee_percent',{percent: (order.grabbingFeeRate??0.03)*100})}</Text>
      <Text style={styles.row}>{t('net_receive_total')}: {netLocalStr}</Text>
      <Text style={styles.row}>{t('payout_address')||'收款地址'}: {order.receiptAddress || '—'}</Text>
      <Text style={styles.row}>{t('created_time')||'创建时间'}: {new Date(order.createdAt).toLocaleString()}</Text>

      <View style={{ marginTop: 16 }}>
        {order.status === 'pending_payment' && (
          <PrimaryButton title={t('mark_pending_confirm')||'标记待确认'} onPress={() => changeStatus('pending_confirm')} />
        )}
        {order.status === 'pending_confirm' && (
          <View style={{ gap: 12 }}>
            <PrimaryButton title={t('mark_completed')||'标记已完成'} onPress={() => changeStatus('completed')} />
            <PrimaryButton title={t('mark_dispute')||'标记纠纷'} onPress={() => changeStatus('dispute')} />
          </View>
        )}
        {order.status === 'completed' && (
          <PrimaryButton title={t('withdraw_demo_button')||'申请提现演示'} onPress={submitWithdraw} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex:1, padding:16, backgroundColor:'#F5F5F5' },
  title: { fontSize:18, fontWeight:'700', marginBottom:12 },
  row: { marginTop:8, color:'#424242' },
});