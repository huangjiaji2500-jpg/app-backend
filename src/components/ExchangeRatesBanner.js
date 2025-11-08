import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getDisplayRates } from '../services/rates';
import { useI18n } from '../context/I18nContext';

function formatValue(currency, v, locale){
  if (typeof v !== 'number') v = Number(v)||0;
  if (currency === 'KRW' || currency === 'JPY') {
    try {
      return Math.round(v).toLocaleString(locale||'en-US');
    } catch { return String(Math.round(v)); }
  }
  // USD/CNY 两位小数
  return (Math.round(v*100)/100).toFixed(2);
}

export default function ExchangeRatesBanner(){
  const { colors } = useTheme();
  const { t, currentLanguage } = useI18n();
  const [rates, setRates] = useState({ USD:1, CNY:11, KRW:2250, JPY:237 });
  const localeMap = { zh:'zh-CN', en:'en-US', ko:'ko-KR', ja:'ja-JP' };
  const locale = localeMap[currentLanguage] || 'en-US';

  useEffect(()=>{ (async ()=>{
    try { setRates(await getDisplayRates()); } catch {}
  })(); }, [currentLanguage]);

  return (
    <View style={{ backgroundColor:'#FFFBEA', borderColor:'#F6E05E', borderWidth:1, padding:10, borderRadius:8, marginTop:8 }}>
      <Text style={{ fontWeight:'700', color:'#6B4F00' }}>{t('current_platform_rates') || '当前平台兑换比例'}</Text>
      <Text style={{ marginTop:4, color:'#6B4F00' }}>1 USDT = {formatValue('CNY', rates.CNY, locale)} CNY</Text>
      <Text style={{ marginTop:2, color:'#6B4F00' }}>1 USDT = {formatValue('KRW', rates.KRW, locale)} KRW</Text>
      <Text style={{ marginTop:2, color:'#6B4F00' }}>1 USDT = {formatValue('JPY', rates.JPY, locale)} JPY</Text>
      <Text style={{ marginTop:2, color:'#6B4F00' }}>1 USDT = {formatValue('USD', rates.USD, locale)} USD</Text>
    </View>
  );
}
