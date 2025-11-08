import React from 'react';
import { FlatList, TouchableOpacity, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

function getMethodLabel(item) {
  if (!item) return '';
  const type = item.type;
  const data = item.data || {};
  if (type === 'usdt_trc20') return data.address || '';
  if (type === 'kakao_pay') return data.kakaoPhone || '';
  if (type === 'kr_bank_card') return `${data.bankName || ''} ****${String(data.bankCardNumber||'').slice(-4)}`;
  if (type === 'visa' || type === 'mastercard') return `${type === 'visa' ? 'Visa' : 'Mastercard'} ****${String(data.cardNumber||'').slice(-4)}`;
  return '';
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
        <Text style={{ fontSize:12, color:'#424242', maxWidth: itemMaxWidth }} numberOfLines={1}>{getMethodLabel(item)}</Text>
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
