import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { addPaymentMethod, getPaymentMethods, updatePaymentMethod, validateMethod, BANK_NAME_MAP_I18N_KEYS } from '../services/paymentMethods';

const TYPES = [
  { value:'kakao_pay', labelKey:'method_kakao_pay' },
  { value:'kr_bank_card', labelKey:'method_kr_bank_card' },
  { value:'visa', labelKey:'method_visa' },
  { value:'mastercard', labelKey:'method_mastercard' },
  { value:'usdt_trc20', labelKey:'method_usdt_trc20' },
];

export default function PaymentMethodEdit({ route, navigation }) {
  const editingId = route?.params?.id || null;
  const { colors, borderRadius, spacing } = useTheme();
  const { t } = useI18n();
  const [type, setType] = useState('kakao_pay');
  const [data, setData] = useState({});

  useEffect(()=>{ (async ()=>{
    if (editingId) {
      const list = await getPaymentMethods();
      const item = list.find(i=> i.id === editingId);
      if (item) { setType(item.type); setData(item.data || {}); }
    }
  })(); }, [editingId]);

  const onSave = async () => {
    const err = validateMethod({ type, data });
    if (err) { Alert.alert(t('alert_title'), t(err) || err); return; }
    const payload = { type, data: { ...data } };
    // 安全：CVV 不持久化
    if (payload.data.cvv) delete payload.data.cvv;
    if (editingId) {
      await updatePaymentMethod(editingId, payload);
    } else {
      await addPaymentMethod(payload);
    }
    Alert.alert(t('submit_success') || '保存成功');
    navigation.goBack();
  };

  const renderTypeSelector = () => (
    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
      {TYPES.map(tp => (
        <TouchableOpacity key={tp.value} onPress={()=> setType(tp.value)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor: type===tp.value? colors.primary: colors.border, backgroundColor: type===tp.value? '#E3F2FD':'#fff' }}>
          <Text style={{ color: type===tp.value? colors.primary: '#424242' }}>{t(tp.labelKey)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const Input = ({ label, placeholder, secure, value, onChangeText, keyboardType='default' }) => (
    <View style={{ marginTop:12 }}>
      <Text style={{ marginBottom:6 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} secureTextEntry={!!secure} autoCapitalize="none" style={{ height:44, borderWidth:1, borderColor:colors.border, borderRadius:8, paddingHorizontal:10 }} />
    </View>
  );

  const renderForm = () => {
    if (type === 'kakao_pay') {
      return (
        <>
          <Input label={t('kakao_phone')} placeholder={'010-1234-5678'} keyboardType='numeric' value={data.kakaoPhone||''} onChangeText={v=> setData(p=>({ ...p, kakaoPhone:v }))} />
        </>
      );
    }
    if (type === 'kr_bank_card') {
      return (
        <>
          <Text style={{ marginTop:12 }}>{t('kr_bank_name')}</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:6 }}>
            {['KEB','SHINHAN','KB','WOORI'].map(code => (
              <TouchableOpacity key={code} onPress={()=> setData(p=>({ ...p, bankName:code }))} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor: data.bankName===code? colors.primary: colors.border, backgroundColor: data.bankName===code? '#E3F2FD':'#fff' }}>
                <Text style={{ color: data.bankName===code? colors.primary: '#424242' }}>{t(BANK_NAME_MAP_I18N_KEYS[code])}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input label={t('kr_bank_card_number')} placeholder={'13-16 digits'} keyboardType='numeric' value={data.bankCardNumber||''} onChangeText={v=> setData(p=>({ ...p, bankCardNumber:v.replace(/\D/g,'') }))} />
          <Input label={t('kr_account_name')} placeholder={t('card_holder')} value={data.accountName||''} onChangeText={v=> setData(p=>({ ...p, accountName:v }))} />
        </>
      );
    }
    if (type === 'visa' || type === 'mastercard') {
      return (
        <>
          <Input label={t('card_number')} placeholder={type==='visa'? '4*************': '5***************'} keyboardType='numeric' value={data.cardNumber||''} onChangeText={v=> setData(p=>({ ...p, cardNumber:v.replace(/\s/g,'') }))} />
          <Input label={t('card_holder')} placeholder={'JOHN DOE / 山田太郎'} value={data.cardHolder||''} onChangeText={v=> setData(p=>({ ...p, cardHolder:v }))} />
          <Input label={t('expiry_date')} placeholder={'MM/YY'} keyboardType='numeric' value={data.expiry||''} onChangeText={v=> setData(p=>({ ...p, expiry:v }))} />
          <Input label={'CVV'} placeholder={'***'} keyboardType='numeric' secure value={data.cvv||''} onChangeText={v=> setData(p=>({ ...p, cvv:v.replace(/\D/g,'').slice(0,3) }))} />
        </>
      );
    }
    if (type === 'usdt_trc20') {
      return (
        <>
          <Input label={t('usdt_address')} placeholder={'T... (TRC20)'} value={data.address||''} onChangeText={v=> setData(p=>({ ...p, address:v }))} />
        </>
      );
    }
    return null;
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={{ fontSize:18, fontWeight:'700' }}>{editingId? (t('edit_payment_method')||'编辑支付方式') : (t('add_payment_method')||'添加支付方式')}</Text>
      <View style={{ height:12 }} />
      {/* 使用与安全提示 */}
      <View style={{ backgroundColor:'#FFF', borderRadius:8, padding:12, borderWidth:1, borderColor:colors.divider, marginBottom:8 }}>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>{t('pm_tips_title') || '使用与安全提示'}</Text>
        <Text style={{ fontSize:12, lineHeight:18, color:'#616161' }}>{t('pm_tips_body')}</Text>
      </View>
      {renderTypeSelector()}
      {renderForm()}
      <View style={{ height:16 }} />
      <PrimaryButton title={t('save_method') || '保存'} onPress={onSave} />
    </ScrollView>
  );
}
