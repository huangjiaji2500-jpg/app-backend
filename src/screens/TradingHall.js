import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput, Alert, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import SegmentTabs from '../components/ui/SegmentTabs';
import MerchantCard from '../components/MerchantCard';
import SkeletonList from '../components/SkeletonList';
import TickerMarquee from '../components/TickerMarquee';
import PrimaryButton from '../components/ui/PrimaryButton';
import api from '../services/api';
import { applyRateToMerchantUnitPrice, getDisplayRates } from '../services/rates';

export default function TradingHall({ navigation }) {
  const { colors, spacing } = useTheme();
  const { t } = useI18n();
  const [tab, setTab] = useState('sell');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [merchants, setMerchants] = useState([]);
  const [amount, setAmount] = useState('');

  const [showFilter, setShowFilter] = useState(false);
  const [filterOption, setFilterOption] = useState(null); // 'transactions_desc' | 'settlement_fast' | 'limit_asc'

  const [ratesStamp, setRatesStamp] = useState(0);
  const loadMerchants = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/trading/merchants');
      let list = resp.data || [];
      if (!list.length) {
        list = [
          { id: 'm1', name: 'OK商家', returnAmount: 100000, orderLimitMin: 100, orderLimitMax: 99999, settlementTimeMin: 0, settlementTimeMax: 12, unitPrice: 9.0, transactions: 108, successRate: 0.47 },
          { id: 'm2', name: 'HUOBI商家', returnAmount: 100000, orderLimitMin: 500, orderLimitMax: 100000, settlementTimeMin: 0, settlementTimeMax: 12, unitPrice: 8.5, transactions: 2279, successRate: 0.24 },
          { id: 'm3', name: 'FAST商家', returnAmount: 82000, orderLimitMin: 50, orderLimitMax: 80000, settlementTimeMin: 0, settlementTimeMax: 5, unitPrice: 8.9, transactions: 560, successRate: 0.62 },
          { id: 'm4', name: 'SLOW商家', returnAmount: 76000, orderLimitMin: 200, orderLimitMax: 90000, settlementTimeMin: 10, settlementTimeMax: 30, unitPrice: 8.6, transactions: 310, successRate: 0.71 },
        ];
      }
      // 应用平台汇率调节
      const adjusted = await Promise.all(list.map(async m => ({ ...m, unitPrice: await applyRateToMerchantUnitPrice(m.unitPrice) })));
      if (filterOption === 'transactions_desc') list.sort((a,b)=> (b.transactions||0) - (a.transactions||0));
      else if (filterOption === 'settlement_fast') list.sort((a,b)=> (a.settlementTimeMax||0) - (b.settlementTimeMax||0));
      else if (filterOption === 'limit_asc') list.sort((a,b)=> (a.orderLimitMin||0) - (b.orderLimitMin||0));
  setMerchants(adjusted);
      setRatesStamp(Date.now());
    } catch (e) {
      let list = [
        { id: 'm1', name: 'OK商家', returnAmount: 100000, orderLimitMin: 100, orderLimitMax: 99999, settlementTimeMin: 0, settlementTimeMax: 12, unitPrice: 9.0, transactions: 108, successRate: 0.47 },
        { id: 'm2', name: 'HUOBI商家', returnAmount: 100000, orderLimitMin: 500, orderLimitMax: 100000, settlementTimeMin: 0, settlementTimeMax: 12, unitPrice: 8.5, transactions: 2279, successRate: 0.24 },
        { id: 'm3', name: 'FAST商家', returnAmount: 82000, orderLimitMin: 50, orderLimitMax: 80000, settlementTimeMin: 0, settlementTimeMax: 5, unitPrice: 8.9, transactions: 560, successRate: 0.62 },
        { id: 'm4', name: 'SLOW商家', returnAmount: 76000, orderLimitMin: 200, orderLimitMax: 90000, settlementTimeMin: 10, settlementTimeMax: 30, unitPrice: 8.6, transactions: 310, successRate: 0.71 },
      ];
      const adjusted = await Promise.all(list.map(async m => ({ ...m, unitPrice: await applyRateToMerchantUnitPrice(m.unitPrice) })));
      if (filterOption === 'transactions_desc') list.sort((a,b)=> (b.transactions||0) - (a.transactions||0));
      else if (filterOption === 'settlement_fast') list.sort((a,b)=> (a.settlementTimeMax||0) - (b.settlementTimeMax||0));
      else if (filterOption === 'limit_asc') list.sort((a,b)=> (a.orderLimitMin||0) - (b.orderLimitMin||0));
  setMerchants(adjusted);
      setRatesStamp(Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMerchants(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMerchants();
    setRefreshing(false);
  };

  const onQuickMatch = async () => {
    const a = Number(amount);
    if (!a || a <= 0) {
    Alert.alert(t('alert_title'), t('input_usdt_amount_alert'));
      return;
    }
    try {
      const resp = await api.get('/trading/quick-match', { params: { amount: a } });
      const m = resp.data;
      if (m) {
      Alert.alert(t('match_success'), `${m.name} · ${t('unit_price')}: $${m.unitPrice}`);
      } else {
      Alert.alert(t('match_not_found_title'), t('match_not_found'));
      }
    } catch (e) {
     Alert.alert(t('alert_title'), t('service_unavailable'));
    }
  };

  const renderItem = ({ item }) => (
    <MerchantCard
      item={item}
      ratesRefreshTick={ratesStamp}
      onSell={() => {
        navigation.navigate('OrderCreate', { merchant: item });
      }}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.md }] }>
      <TickerMarquee />
      
      <View style={{ flexDirection:'row', alignItems:'center', marginTop:8 }}>
        <View style={{ flex:1 }}>
          <SegmentTabs
            value={tab}
            onChange={setTab}
            tabs={[{ label: t('sell_usdt'), value: 'sell' }, { label: t('quick_match'), value: 'quick' }]}
          />
        </View>
        <TouchableOpacity onPress={() => setShowFilter(true)} style={{ marginLeft:8, backgroundColor:'#2196F3', paddingHorizontal:14, paddingVertical:10, borderRadius:8 }} activeOpacity={0.8}>
          <Text style={{ color:'#fff', fontWeight:'600' }}>{t('filter') || '筛选'}</Text>
        </TouchableOpacity>
      </View>

      {tab === 'quick' ? (
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
           <TextInput
             placeholder={t('input_usdt_amount')}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border }}
          />
           <PrimaryButton title={t('start_match')} onPress={onQuickMatch} style={{ marginLeft: 8, paddingHorizontal: 16 }} />
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={merchants}
            keyExtractor={(item, idx) => item._id || item.id || String(idx)}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        )}
      </View>

      <Modal visible={showFilter} animationType="slide" transparent onRequestClose={()=>setShowFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.drawer}>
            <Text style={styles.drawerTitle}>{t('merchant_filter') || '商家筛选'}</Text>
            <TouchableOpacity style={styles.filterBtn} onPress={()=>{ setFilterOption('transactions_desc'); setShowFilter(false); loadMerchants(); }}>
              <Text style={styles.filterText}>{t('filter_transactions_desc') || '成交笔数（高→低）'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterBtn} onPress={()=>{ setFilterOption('settlement_fast'); setShowFilter(false); loadMerchants(); }}>
              <Text style={styles.filterText}>{t('filter_settlement_fast') || '结算时间（快→慢）'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterBtn} onPress={()=>{ setFilterOption('limit_asc'); setShowFilter(false); loadMerchants(); }}>
              <Text style={styles.filterText}>{t('filter_limit_asc') || '订单限额（小→大）'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterBtn,{backgroundColor:'#E53935'}]} onPress={()=>{ setFilterOption(null); setShowFilter(false); loadMerchants(); }}>
              <Text style={[styles.filterText,{color:'#fff'}]}>{t('reset') || '重置'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignSelf:'flex-end', marginTop:12 }} onPress={()=>setShowFilter(false)}>
              <Text style={{ color:'#1976D2' }}>{t('close') || '关闭'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'flex-end' },
  drawer:{ backgroundColor:'#fff', padding:16, borderTopLeftRadius:16, borderTopRightRadius:16 },
  drawerTitle:{ fontSize:16, fontWeight:'700', marginBottom:12 },
  filterBtn:{ backgroundColor:'#F5F5F5', paddingVertical:12, paddingHorizontal:12, borderRadius:8, marginTop:8 },
  filterText:{ color:'#212121', fontWeight:'600' }
});