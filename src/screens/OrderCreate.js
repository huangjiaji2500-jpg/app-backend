import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
// 避免在 RN/Expo 上对 uuid 的原生依赖问题，这里用简化版 ID 生成
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUsername } from '../services/auth';
import { getBaseRateForLang, getLocalCurrencyByLang, formatLocalCurrency, getDisplayRates } from '../services/rates';
import { getMinOrderAmount, DEFAULT_PLATFORM_CONFIG } from '../services/platformConfig';
import { queueOrderSync } from '../services/remoteSync';
import { pushTicker } from '../services/ticker';
import { getPaymentMethods } from '../services/paymentMethods';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import { getWalletAddressInfo, decreaseUserBalance } from '../services/assets';
import * as log from '../services/log';

const PRESETS_USDT = [9, 50, 100, 200];
const ORDERS_KEY = 'LOCAL_ORDERS';

async function getLocalOrders(){
  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function setLocalOrders(list){
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(list));
}

export default function OrderCreate({ route, navigation }){
  const { merchant } = route.params;
  const { colors, borderRadius } = useTheme();
  const { t, currentLanguage } = useI18n();
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('USDT'); // 'USDT' | 'LOCAL'
  const [val, setVal] = useState('');
  // 单价改为使用“平台兑换比例”中的 USD 值（1 USDT = displayRates.USD），不再引用商家自定义单价
  const [priceUSD, setPriceUSD] = useState(1.0);
  const [displayRates, setDisplayRates] = useState({ USD:1, CNY:11, KRW:2250, JPY:237 });
  const [methods, setMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState(null);
  // 使用平台集中默认值，后续异步加载真实配置
  const [minOrderAmount, setMinOrderAmount] = useState(DEFAULT_PLATFORM_CONFIG.minOrderAmount);

  const merchantDisplayName = useMemo(() => {
    const name = merchant?.name;
    if (!name) return t('unknown_merchant');
    if (name === 'OK商家') return t('ok_merchant');
    if (name === 'HUOBI商家') return t('huobi_merchant');
    if (name === 'FAST商家') return t('fast_merchant');
    if (name === 'SLOW商家') return t('slow_merchant');
    return name;
  }, [merchant?.name, t, currentLanguage]);

  const loadMethods = async () => {
    const all = await getPaymentMethods();
    // 展示全部绑定方式（USDT/Kakao/银行/信用卡等），并额外合入“收款地址”页的默认 USDT 地址
    let list = Array.isArray(all) ? [...all] : [];
    // 同步“收款地址”中的默认地址（用户在 PaymentAddress 中填写的地址），作为一个可选项（仅针对 USDT）
    try {
      const wallet = await getWalletAddressInfo();
      if (wallet && wallet.address && typeof wallet.address === 'string') {
        const walletItem = { id: 'WALLET_DEFAULT', type: 'usdt_trc20', data: { address: wallet.address }, source: 'wallet' };
        // 若列表中没有相同地址，则插入最前
        const hasSame = list.some(x => x.type==='usdt_trc20' && (x?.data?.address || '').trim() === wallet.address.trim());
        if (!hasSame) {
          list = [walletItem, ...list];
        }
      }
    } catch {}
    setMethods(list);
    // 优先选中默认方式；否则选中钱包默认；否则第一个
    const preferred = list.find(x => x.isDefault) || list.find(x => x.id === 'WALLET_DEFAULT') || list[0];
    if (preferred) setSelectedMethodId(preferred.id);
  };

  // 初次加载
  useEffect(()=>{ loadMethods(); },[]);
  // 重新获得焦点时刷新，确保从添加页面返回后列表更新
  useFocusEffect(React.useCallback(() => {
    loadMethods();
  }, []));

  useEffect(() => { (async () => {
    try {
      const disp = await getDisplayRates();
      setDisplayRates(disp);
      setPriceUSD(Number((disp.USD || 1).toFixed(6)));
    } catch {
      setPriceUSD(1.0);
    }
    try {
      const min = await getMinOrderAmount();
      setMinOrderAmount(Number(min) || DEFAULT_PLATFORM_CONFIG.minOrderAmount);
    } catch {
      // 保持集中默认，不再硬编码具体数值
      setMinOrderAmount(DEFAULT_PLATFORM_CONFIG.minOrderAmount);
    }
  })(); }, [merchant]);

  // 基础本地汇率（用于显示本地币）
  const [baseLocalRate, setBaseLocalRate] = useState(1);
  const [baseUsdRate, setBaseUsdRate] = useState(1);
  const [localCurrency, setLocalCurrency] = useState('USD');
  useEffect(() => { (async ()=>{
    setLocalCurrency(getLocalCurrencyByLang(currentLanguage));
    const rate = await getBaseRateForLang(currentLanguage);
    setBaseLocalRate(rate);
    try {
      const disp = await getDisplayRates();
      setBaseUsdRate(disp.USD || 1);
    } catch { setBaseUsdRate(1); }
  })(); }, [currentLanguage]);

  const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 金额解析与换算
  const parsed = Number(val) || 0;
  // 直接使用 displayRates 中的本地币比例作为 "1 USDT = X 本地币"，与 MerchantCard 保持一致
  const unitPriceLocal = Number((baseLocalRate || 1).toFixed(6)); // 1 USDT = ? 本地币
  const amountUSDT = mode === 'USDT' ? parsed : (parsed > 0 ? Number((parsed / (unitPriceLocal || 1)).toFixed(6)) : 0);
  const totalUSD = Number((amountUSDT * priceUSD).toFixed(2));
  const totalLocal = Number((amountUSDT * unitPriceLocal).toFixed((localCurrency==='KRW'||localCurrency==='JPY')?0:2));

  // 费用比率（后续可抽离配置）
  const SERVICE_FEE_RATE = 0.02;
  const GRABBING_FEE_RATE = 0.03;

  // 费用计算（本地展示 & USD 存储）
  const serviceFeeLocal = Number((totalLocal * SERVICE_FEE_RATE).toFixed((localCurrency==='KRW'||localCurrency==='JPY')?0:2));
  const grabbingFeeLocal = Number((totalLocal * GRABBING_FEE_RATE).toFixed((localCurrency==='KRW'||localCurrency==='JPY')?0:2));
  const netReceiveLocal = Number((totalLocal - serviceFeeLocal - grabbingFeeLocal).toFixed((localCurrency==='KRW'||localCurrency==='JPY')?0:2));
  // USD 口径用于存储
  const serviceFeeUSD = Number((totalUSD * SERVICE_FEE_RATE).toFixed(2));
  const grabbingFeeUSD = Number((totalUSD * GRABBING_FEE_RATE).toFixed(2));
  const netReceiveUSD = Number((totalUSD - serviceFeeUSD - grabbingFeeUSD).toFixed(2));

  const [availableBalanceUSDT, setAvailableBalanceUSDT] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadBalance = async () => {
    setBalanceLoading(true);
    try {
      // 从资产快照中获取 withdrawable 或可用余额；此处我们以 balanceUSDT + commissionTotalUSDT 简化为可用资金
      const snap = await import('../services/assets').then(m => m.getAssetSnapshot());
      // 使用充值余额作为下单可用余额口径（availableBalanceUSDT）
      const usable = Number(snap.availableBalanceUSDT) || 0;
      setAvailableBalanceUSDT(Number(usable.toFixed(6)));
    } catch (e) {
      setAvailableBalanceUSDT(0);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(()=> { loadBalance(); }, []);
  useFocusEffect(React.useCallback(()=> { loadBalance(); }, []));

  const onSubmit = async () => {
    if (!amountUSDT || amountUSDT <= 0) { Alert.alert(t('alert_title'), t('invalid_amount')); return; }
    if (amountUSDT < minOrderAmount) {
      Alert.alert(t('alert_title'), t('min_order_amount_not_met', { min: minOrderAmount, amount: amountUSDT }));
      return;
    }
    if (!selectedMethodId) { Alert.alert(t('alert_title'), methods.length === 0 ? t('add_usdt_address_first') : t('select_payment_method')); return; }
    const method = methods.find(m => m.id === selectedMethodId);

    // 余额校验：不足则弹窗阻断
    if (amountUSDT > availableBalanceUSDT) {
      Alert.alert(
        t('insufficient_balance_title'),
        t('insufficient_balance_desc_net', {
          amount: amountUSDT,
          balance: availableBalanceUSDT,
        }),
        [
          { text: t('think_again_btn'), style: 'cancel' },
          { text: t('go_deposit_btn'), onPress: ()=> navigation.navigate('Recharge') },
        ]
      );
      return;
    }

    Alert.alert(t('confirm_order'), t('confirm_place_order_message', { amount: amountUSDT, usd: totalUSD }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: async () => {
        try {
          const creator = await getCurrentUsername();
          const order = {
            id: genId(),
            amountUSDT,
            unitPrice: priceUSD, // USD 单价（来自平台兑换比例）
            originalMerchantUnitPrice: merchant?.unitPrice || null, // 原商家基价留档（不参与计算）
            totalUSD, // 出售总价（未扣费）
            netReceiveUSD, // 获得总额（扣除服务费+抢单费）
            serviceFeeRate: SERVICE_FEE_RATE,
            grabbingFeeRate: GRABBING_FEE_RATE,
            feeUSD: serviceFeeUSD, // 合约服务费（USD）
            grabbingFeeUSD, // 抢单费（USD）
            baseLocalRate,
            localCurrency,
            status: 'pending_admin_review',
            receiptAddress: method?.data?.address || method?.data?.kakaoPhone || method?.data?.cardNumber || method?.data?.bankCardNumber || '',
            paymentMethod: method?.type || 'USDT(TRC20)',
            notes: note,
            merchant: merchantDisplayName,
            createdAt: new Date().toISOString(),
            creatorUsername: creator || 'unknown',
          };
          const list = await getLocalOrders();
          list.unshift(order);
          await setLocalOrders(list);
          // 异步远端同步（失败不影响本地）
          try { queueOrderSync(order); } catch {}
          try { log.info('order_created', { orderId: order.id, amountUSDT }); } catch {}
          // 立即扣除用户 USDT（防止重复下单滥用）。后台若拒绝，将在审核页退回。
          try { await decreaseUserBalance(creator, Number(amountUSDT)||0); } catch {}
          try { pushTicker(t('ticker_order_created', { amount: amountUSDT })); } catch {}
          // 直接跳转到“我的订单”，避免二次弹窗在部分安卓机型上阻塞
          navigation.navigate('MainTabs', { screen: '我的订单' });
        } catch (e) {
          Alert.alert(t('order_submit_failed'), e?.message || 'Error');
        }
      }}
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex:1 }}
        contentContainerStyle={{ padding:16, paddingBottom:80 }}
        keyboardShouldPersistTaps="handled"
      >
    {/* 顶部信息卡片 */}
    <Text style={{ fontSize:18, fontWeight:'700', marginBottom:8 }}>{t('place_order_to', { merchant: merchantDisplayName })}</Text>
      <View style={{ backgroundColor:'#F3F4F6', borderRadius:12, padding:12, borderWidth:1, borderColor:'#E0E0E0' }}>
        <View style={{ flexDirection:'row' }}>
          <View style={{ flex:1 }}>
            <Text style={{ color:'#757575' }}>{t('unit_price')} ({localCurrency})</Text>
            <Text style={{ fontSize:22, fontWeight:'700', marginTop:4 }}>{formatLocalCurrency(unitPriceLocal, localCurrency)}</Text>
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ color:'#757575' }}>{t('order_limit')}</Text>
            <Text style={{ fontSize:16, fontWeight:'700', marginTop:4 }}>{Math.max(minOrderAmount, merchant?.orderLimitMin || 0)}-{merchant?.orderLimitMax || 0} USDT</Text>
          </View>
        </View>
        <View style={{ marginTop:12 }}>
          <Text style={{ color:'#757575', marginBottom:6 }}>{t('completion_progress')}</Text>
          <View style={{ height:8, backgroundColor:'#E0E0E0', borderRadius:8, overflow:'hidden' }}>
            <View style={{ width:`${Math.round((merchant?.successRate||0)*100)}%`, backgroundColor:'#2196F3', height:8 }} />
          </View>
        </View>
      </View>

      {/* 购买信息 / 输入模式 */}
      <View style={{ marginTop:16 }}>
        <View style={{ flexDirection:'row', backgroundColor:'#ECEFF1', borderRadius:8, overflow:'hidden' }}>
          {['USDT','LOCAL'].map(m => (
            <TouchableOpacity key={m} onPress={()=>{ setMode(m); setVal(''); }} style={{ flex:1, paddingVertical:10, backgroundColor: mode===m?'#fff':'#ECEFF1', alignItems:'center' }}>
              <Text style={{ fontWeight:'700', color: mode===m?'#1976D2':'#455A64' }}>{m==='USDT'? t('enter_usdt'): t('enter_usd')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={val}
          onChangeText={setVal}
          keyboardType="numeric"
          placeholder={mode==='USDT'? t('enter_or_select_usdt') : t('enter_or_select_usd')}
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md, marginTop:12 }]}
        />

        {mode==='USDT' ? (
          <View style={{ flexDirection:'row', marginTop:8 }}>
            {PRESETS_USDT.filter(p => p >= minOrderAmount).map((p)=> (
              <TouchableOpacity key={p} onPress={()=>setVal(String(p))} style={{ backgroundColor:'#E3F2FD', paddingVertical:8, paddingHorizontal:12, borderRadius:8, marginRight:8 }}>
                <Text style={{ color:'#1565C0', fontWeight:'600' }}>{p} USDT</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* 可用余额移动至此更贴近输入逻辑 */}
  <Text style={{ marginTop:8, color:'#616161' }}>可用余额: {balanceLoading? '...': `${availableBalanceUSDT} USDT`}</Text>
  <Text style={{ marginTop:4, color:'#BF360C', fontSize:12 }}>{t('min_order_amount_label')}: {minOrderAmount} USDT</Text>
      </View>

      {/* 支付方式选择 */}
      <View style={{ marginTop:16 }}>
        <Text style={{ fontWeight:'600', marginBottom:6 }}>{t('select_payment_method')}</Text>
        {methods.length === 0 ? (
          <TouchableOpacity onPress={()=> navigation.navigate('PaymentMethodEdit')} style={{ padding:12, borderWidth:1, borderColor:colors.border, borderRadius:8, backgroundColor:'#fff' }}>
            <Text style={{ color:'#D32F2F' }}>{t('add_usdt_address_first')}</Text>
          </TouchableOpacity>
        ) : (
          <PaymentMethodPicker methods={methods} selectedId={selectedMethodId} onSelect={setSelectedMethodId} />
        )}
        {/* 添加/管理入口 */}
        <View style={{ flexDirection:'row', marginTop:8 }}>
          <TouchableOpacity onPress={()=> navigation.navigate('PaymentMethodEdit')} style={{ marginRight:16 }}>
            <Text style={{ color: colors.primary }}>+ {t('add_payment_method') || '添加收款方式'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=> navigation.navigate('PaymentMethodManager')}>
            <Text style={{ color: colors.primary }}>{t('manage_payment_methods') || '管理收款方式'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 费用明细（展示本地币口径） */}
      <View style={{ marginTop:16, backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#E0E0E0', padding:12 }}>
        <Row label={t('exchanged_amount')} value={`${amountUSDT} USDT`} />
        <Row label={t('service_fee_percent', { percent: 2 })} value={`${formatLocalCurrency(serviceFeeLocal, localCurrency)}`} />
        <Row label={t('grabbing_fee_percent', { percent: 3 })} value={`${formatLocalCurrency(grabbingFeeLocal, localCurrency)}`} />
        <Row label={t('net_receive_total')} value={`${formatLocalCurrency(netReceiveLocal, localCurrency)}`} bold />
        <Text style={{ marginTop:4, fontSize:12, color:'#9E9E9E' }}>{t('net_receive_note')}</Text>
  {/* 预计利润已按需求移除 */}
      </View>

      {/* 备注 */}
      <View style={{ marginTop:12 }}>
        <Text>{t('trade_note_optional')}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('optional')}
          style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md }]}
        />
      </View>

      <View style={{ marginTop:16, marginBottom:16 }}>
        <PrimaryButton title={t('confirm_order')} onPress={onSubmit} />
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
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

const Row = ({ label, value, bold }) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:6 }}>
    <Text style={{ color:'#616161' }}>{label}</Text>
    <Text style={{ fontWeight: bold? '700':'600' }}>{value}</Text>
  </View>
);

// ProfitLine 组件已删除