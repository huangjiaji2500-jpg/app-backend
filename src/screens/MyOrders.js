import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import SegmentTabs from '../components/ui/SegmentTabs';
import EmptyState from '../components/EmptyState';
import SkeletonList from '../components/SkeletonList';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useI18n } from '../context/I18nContext';
import { getDisplayRates, getLocalCurrencyByLang, formatLocalCurrency } from '../services/rates';

function useStatusTabs(t){
  return useMemo(() => ([
    { label: t('all'), value: 'all' },
    { label: t('pending_admin_review'), value: 'pending_admin_review' },
    { label: t('approved_payout'), value: 'approved_payout' },
    { label: t('rejected_payout'), value: 'rejected_payout' },
    { label: t('completed'), value: 'completed' },
  ]), [t]);
}

function formatDateTime(ts, lang){
  try{
    const locales = { zh: 'zh-CN', en: 'en-US', ko: 'ko-KR', ja: 'ja-JP' };
    const fmt = new Intl.DateTimeFormat(locales[lang] || 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    return fmt.format(new Date(ts));
  }catch(e){
    return new Date(ts).toLocaleString();
  }
}

export default function MyOrders({ navigation }) {
  const { colors, spacing } = useTheme();
  const { t, currentLanguage } = useI18n();
  const STATUS_OPTIONS = useStatusTabs(t);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [displayRates, setDisplayRates] = useState({ USD:1, CNY:11, KRW:2250, JPY:237 });
  const [localCurrency, setLocalCurrency] = useState('USD');

  useEffect(()=>{ (async ()=>{
    setLocalCurrency(getLocalCurrencyByLang(currentLanguage));
    try { setDisplayRates(await getDisplayRates()); } catch {}
  })(); }, [currentLanguage]);

  const loadOrders = async ({ reset = false } = {}) => {
    try {
      if (reset) setPage(1);
      setLoading(true);
      // 本地优先：没有后端也能看
      const raw = await AsyncStorage.getItem('LOCAL_ORDERS');
      let list = raw ? JSON.parse(raw) : [];
      if (tab !== 'all') list = list.filter(o => o.status === tab);
      // 排序：按状态优先级，然后时间倒序
      const rank = (s) => {
        const map = {
          pending_admin_review: 1,
          approved_payout: 2,
          rejected_payout: 3,
          completed: 9,
        };
        return map[s] || 8;
      };
      list = list.sort((a,b)=>{
        const ra = rank(a.status), rb = rank(b.status);
        if (ra !== rb) return ra - rb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      // 模拟分页
      const start = (reset ? 0 : (page - 1) * 10);
      const items = list.slice(start, start + 10);
      const next = reset ? items : [...orders, ...items];
      setOrders(next);
      setHasMore(list.length > start + items.length);
      if (reset) setPage(1); else setPage(page + 1);
    } catch (e) {
      // 无后端时使用空数据展示空态
      setOrders([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders({ reset: true }); }, [tab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders({ reset: true });
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (!hasMore || loading) return;
    await loadOrders();
  };

  const renderItem = ({ item }) => {
    // 原始出售总额（未扣费）
    const totalUSD = item.totalUSD !== undefined && item.totalUSD !== null
      ? Number(item.totalUSD)
      : (item.amountUSDT && item.unitPrice ? Number(item.amountUSDT) * Number(item.unitPrice) : 0);
    // 到手金额（新字段），向后兼容旧订单：若无 netReceiveUSD 则按旧逻辑回退 totalUSD 或 payTotalUSD
    const netReceiveUSD = item.netReceiveUSD !== undefined && item.netReceiveUSD !== null
      ? Number(item.netReceiveUSD)
      : (item.payTotalUSD !== undefined && item.payTotalUSD !== null
          ? Number(item.payTotalUSD)
          : totalUSD);
  const unitPrice = Number(item.unitPrice || 0);
  const rateUSD = Number(displayRates.USD || 1);
  const rateLocal = localCurrency==='USD' ? rateUSD : Number(displayRates[localCurrency] || 1);
  const netLocal = netReceiveUSD * (rateLocal / (rateUSD || 1));
  const netLocalStr = formatLocalCurrency(netLocal, localCurrency);
  const serviceFeeRate = (item.serviceFeeRate ?? 0.02);
  const grabbingFeeRate = (item.grabbingFeeRate ?? 0.03);
  const serviceFeeUSD = totalUSD * serviceFeeRate;
  const grabbingFeeUSD = totalUSD * grabbingFeeRate;
  const serviceFeeLocal = serviceFeeUSD * (rateLocal / (rateUSD || 1));
  const grabbingFeeLocal = grabbingFeeUSD * (rateLocal / (rateUSD || 1));
  const serviceFeeLocalStr = formatLocalCurrency(serviceFeeLocal, localCurrency);
  const grabbingFeeLocalStr = formatLocalCurrency(grabbingFeeLocal, localCurrency);
    const statusColor = (s) => {
      if (s === 'pending_admin_review') return '#EF6C00';
      if (s === 'approved_payout') return '#1E88E5';
      if (s === 'rejected_payout') return '#E53935';
      if (s === 'completed') return '#2E7D32';
      return '#424242';
    };
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('OrderDetail', { orderId: item._id || item.id })}
        activeOpacity={0.8}
        style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.divider }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems:'center' }}>
          <Text style={{ fontWeight: '700', color: statusColor(item.status) }}>{t(item.status) || item.status}</Text>
          <Text style={{ color: '#999' }}>{formatDateTime(item.createdAt, currentLanguage)}</Text>
        </View>
        <View style={{ marginTop: 6 }}>
          <Text style={{ color:'#616161' }}>{t('amount')}</Text>
          {/* Removed equation line per request */}
          {/* Four-line detail */}
          <View style={{ marginTop:6 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:2 }}>
              <Text style={{ color:'#616161' }}>{t('exchanged_amount')}</Text>
              <Text style={{ fontWeight:'600' }}>{item.amountUSDT} USDT</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
              <Text style={{ color:'#616161' }}>{t('service_fee_percent', { percent: Math.round(serviceFeeRate*100) })}</Text>
              <Text style={{ fontWeight:'600' }}>{serviceFeeLocalStr}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
              <Text style={{ color:'#616161' }}>{t('grabbing_fee_percent', { percent: Math.round(grabbingFeeRate*100) })}</Text>
              <Text style={{ fontWeight:'600' }}>{grabbingFeeLocalStr}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:12 }}>
              <Text style={{ color:'#212121', fontWeight:'600' }}>{t('net_receive_total')}</Text>
              <Text style={{ fontWeight:'700' }}>{netLocalStr}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.md }}>
      <SegmentTabs value={tab} onChange={setTab} tabs={STATUS_OPTIONS} />
      <View style={{ marginTop: 12 }}>
        {loading ? (
          <SkeletonList />)
          : orders.length === 0 ? (
            <EmptyState text={t('empty_state')} />
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item, idx) => item._id || String(idx)}
              renderItem={renderItem}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              onEndReachedThreshold={0.2}
              onEndReached={onEndReached}
            />
          )}
      </View>
    </View>
  );
}