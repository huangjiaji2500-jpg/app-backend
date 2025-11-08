import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import PrimaryButton from './ui/PrimaryButton';
import { useI18n } from '../context/I18nContext';
import { getLocalCurrencyByLang, formatLocalCurrency, getDisplayRates } from '../services/rates';
import { getMinOrderAmount, DEFAULT_PLATFORM_CONFIG } from '../services/platformConfig';

export default function MerchantCard({ item, onSell }) {
  const { colors, borderRadius } = useTheme();
  const { t, currentLanguage } = useI18n();
  const currency = getLocalCurrencyByLang(currentLanguage);
  const [priceDisplay, setPriceDisplay] = React.useState('');
  const [rawUsdPrice, setRawUsdPrice] = React.useState(Number(item.unitPrice||0));
  // 初始值使用集中默认配置，后续异步读取真实配置
  const [platformMin, setPlatformMin] = React.useState(DEFAULT_PLATFORM_CONFIG.minOrderAmount);
  React.useEffect(()=>{ (async ()=>{
    try {
      // 单价改为显示“平台兑换比例”中的当前币种值（即 1 USDT = X 本地币），不再展示商家溢价
      const disp = await getDisplayRates();
      const localValue = disp[currency] || 0; // 1 USDT = localValue [currency]
      setPriceDisplay(formatLocalCurrency(localValue, currency));
      setRawUsdPrice(Number(item.unitPrice||0));
    } catch { setPriceDisplay(formatLocalCurrency(0, currency)); }
    try {
      const m = await getMinOrderAmount();
      setPlatformMin(Number(m) || DEFAULT_PLATFORM_CONFIG.minOrderAmount);
    } catch {
      // 读取失败时退回默认集中配置
      setPlatformMin(DEFAULT_PLATFORM_CONFIG.minOrderAmount);
    }
  })(); }, [currentLanguage, item.unitPrice]);
  return (
    <View style={[styles.card, { backgroundColor: '#fff', borderRadius: borderRadius.lg, borderColor: colors.divider }]}> 
      <View style={styles.header}>
        <Text style={[styles.title]}>{
          item.name === 'OK商家' ? t('ok_merchant') :
          item.name === 'HUOBI商家' ? t('huobi_merchant') :
          item.name === 'FAST商家' ? t('fast_merchant') :
          item.name === 'SLOW商家' ? t('slow_merchant') : item.name
        }</Text>
        <Text style={{ color: '#999' }}>{item.successRate ? `${Math.round(item.successRate * 100)}%` : ''}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('return_amount') || t('amount')}</Text>
        <Text style={styles.value}>{item.returnAmount || 0}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('order_limit')}</Text>
        <Text style={styles.value}>{Math.max(platformMin, item.orderLimitMin)} - {item.orderLimitMax} USDT</Text>
      </View>
      <View style={styles.row}>
  <Text style={styles.label}>{t('settlement_time')}</Text>
  <Text style={styles.value}>{item.settlementTimeMin}-{item.settlementTimeMax} {t('minutes')}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('unit_price')}</Text>
        <Text style={[styles.value, { color: '#E53935', fontWeight:'700' }]}>{priceDisplay}</Text>
      </View>
      <View style={[styles.footer]}>
        <Text style={{ color: '#999' }}>{t('transaction_count')}: {item.transactions || 0}</Text>
        <PrimaryButton title={t('sell_btn')} onPress={onSell} style={{ minWidth: 100 }} />
      </View>
      <Text style={{ marginTop:4, color:'#B0BEC5', fontSize:11 }}>{t('platform_min_order_amount_hint', { min: platformMin })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: { color: '#757575' },
  value: { color: '#212121' },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});