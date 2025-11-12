import React from 'react';
import { FlatList, TouchableOpacity, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

// 银行名映射 i18n keys（与 services/paymentMethods.js 保持一致）
const BANK_NAME_MAP_I18N_KEYS = {
  KEB: 'bank_name_keb_hana',
  SHINHAN: 'bank_name_shinhan',
  KB: 'bank_name_kb',
  WOORI: 'bank_name_woori'
};

function getMethodLabel(item, t) {
  if (!item) return '';
  const type = item.type;
  const data = item.data || {};
  let base = '';
  if (type === 'usdt_trc20') base = data.address || '';
  else if (type === 'kakao_pay') base = data.kakaoPhone || '';
  else if (type === 'kr_bank_card') {
    const bankKey = BANK_NAME_MAP_I18N_KEYS[data.bankName] || data.bankName || '';
    const bankNameI18n = bankKey ? (t(bankKey) || bankKey) : '';
    base = `${bankNameI18n} ****${String(data.bankCardNumber||'').slice(-4)}`;
  }
  else if (type === 'visa' || type === 'mastercard') base = `${type === 'visa' ? 'Visa' : 'Mastercard'} ****${String(data.cardNumber||'').slice(-4)}`;
  if (item.isDefault) base = base ? (base + ' ★') : '★';
  return base;
}

export default function PaymentMethodPicker({
  methods = [],
  selectedId,
  onSelect,
  horizontal = true,
  itemMaxWidth = 180,
  showSelectedTag = true,
}){
  const { colors } = useTheme();
  const { t } = useI18n();

  const renderItem = ({ item }) => {
    const selected = selectedId === item.id;
    return (
      <TouchableOpacity onPress={()=> onSelect && onSelect(item.id)} style={{ padding:12, borderWidth:1, borderColor: selected? colors.primary: colors.border, borderRadius:8, backgroundColor: selected? '#E3F2FD':'#fff', marginRight: horizontal? 12: 0, marginBottom: horizontal? 0: 10 }}>
  <Text style={{ fontSize:12, color:'#424242', maxWidth: itemMaxWidth }} numberOfLines={1}>{getMethodLabel(item, t)}</Text>
        {showSelectedTag && selected && (
          <Text style={{ color: colors.primary, marginTop: 4 }}>{t('selected_address') || '已选择'}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (!methods || methods.length === 0) {
    return <View />;
  }

  return (
    <FlatList
      data={methods}
      keyExtractor={(i)=> i.id}
      horizontal={horizontal}
      showsHorizontalScrollIndicator={false}
      renderItem={renderItem}
    />
  );
}

export { getMethodLabel };
