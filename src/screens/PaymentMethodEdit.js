import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Keyboard } from 'react-native';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { addPaymentMethod, getPaymentMethods, updatePaymentMethod, validateMethod, BANK_NAME_MAP_I18N_KEYS, setDefaultPaymentMethod } from '../services/paymentMethods';

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
  const [inputFocused, setInputFocused] = useState(false);
  const [data, setData] = useState({});

  useEffect(()=>{ (async ()=>{
    if (editingId) {
      const list = await getPaymentMethods();
      const item = list.find(i=> i.id === editingId);
      if (item) { setType(item.type); setData(item.data || {}); }
    }
  })(); }, [editingId]);

  const onSave = async () => {
    // Ensure any focused inputs are blurred and have synced their local values to `data`
    try { Keyboard.dismiss(); } catch {}
    // small delay to allow onBlur handlers to propagate local values
    await new Promise(resolve => setTimeout(resolve, 120));
    // gather latest values from input refs to ensure we validate/save the freshest data
    const merged = { ...data };
    for (const k of Object.keys(inputRefs.current || {})){
      try {
        const v = inputRefs.current[k]?.current?.getValue?.();
        if (v !== undefined) merged[k] = v;
      } catch(e){ /* ignore */ }
    }
    const err = validateMethod({ type, data: merged });
    if (err) { Alert.alert(t('alert_title'), t(err) || err); return; }
    const payload = { type, data: { ...merged } };
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
    // 不通过 pointerEvents 阻止切换（用户应能显式切换）。
    // 改为在切换前主动收起键盘并清理焦点，避免误触同时允许用户切换。
    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, opacity: inputFocused ? 0.9 : 1 }}>
      {TYPES.map(tp => (
        <TouchableOpacity
          key={tp.value}
          onPress={() => {
            try { Keyboard.dismiss(); } catch {}
            // small delay to allow onBlur to run and local values to sync
            setTimeout(()=>{
              setInputFocused(false);
              setType(tp.value);
            }, 60);
          }}
          style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor: type===tp.value? colors.primary: colors.border, backgroundColor: type===tp.value? '#E3F2FD':'#fff' }}
        >
          <Text style={{ color: type===tp.value? colors.primary: '#424242' }}>{t(tp.labelKey)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCount = useRef(0);
  renderCount.current += 1;

  const inputRefs = useRef({});
  const getInputRef = (name) => {
    if (!inputRefs.current[name]) inputRefs.current[name] = React.createRef();
    return inputRefs.current[name];
  };

  const Input = React.forwardRef(({ label, placeholder, secure, value, onChangeText, keyboardType='default' }, ref) => {
    const textRef = useRef(null);
    const [localValue, setLocalValue] = useState(value || '');
    useEffect(()=>{ setLocalValue(value || ''); }, [value]);
    useEffect(()=>{ console.log('[PaymentMethodEdit] Input render', label, 'renderCount=', renderCount.current); });

    const handleLocalChange = (v) => { setLocalValue(v); };
    const handleBlur = () => { console.log('[PaymentMethodEdit] Input blur', label, 'final=', localValue); setInputFocused(false); onChangeText?.(localValue); };
    const handleFocus = () => { console.log('[PaymentMethodEdit] Input focus', label); setInputFocused(true); };

    React.useImperativeHandle(ref, () => ({
      getValue: () => localValue,
      blur: () => { try { textRef.current && textRef.current.blur(); } catch{} },
      focus: () => { try { textRef.current && textRef.current.focus(); } catch{} }
    }));

    return (
      <View style={{ marginTop:12 }}>
        <Text style={{ marginBottom:6 }}>{label}</Text>
        <TextInput
          ref={textRef}
          value={localValue}
          onChangeText={handleLocalChange}
          placeholder={placeholder}
          keyboardType={keyboardType}
          secureTextEntry={!!secure}
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          returnKeyType="done"
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{ height:44, borderWidth:1, borderColor:colors.border, borderRadius:8, paddingHorizontal:10 }}
        />
      </View>
    );
  });

  const renderForm = () => {
    if (type === 'kakao_pay') {
      return (
        <>
          <Input ref={getInputRef('kakaoPhone')} label={t('kakao_phone')} placeholder={'010-1234-5678'} keyboardType='numeric' value={data.kakaoPhone||''} onChangeText={v=> setData(p=>({ ...p, kakaoPhone:v }))} />
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
          <Input ref={getInputRef('bankCardNumber')} label={t('kr_bank_card_number')} placeholder={'13-16 digits'} keyboardType='numeric' value={data.bankCardNumber||''} onChangeText={v=> setData(p=>({ ...p, bankCardNumber:v.replace(/\D/g,'') }))} />
          <Input ref={getInputRef('accountName')} label={t('kr_account_name')} placeholder={t('card_holder')} value={data.accountName||''} onChangeText={v=> setData(p=>({ ...p, accountName:v }))} />
        </>
      );
    }
    if (type === 'visa' || type === 'mastercard') {
      return (
        <>
          <Input ref={getInputRef('cardNumber')} label={t('card_number')} placeholder={type==='visa'? '4*************': '5***************'} keyboardType='numeric' value={data.cardNumber||''} onChangeText={v=> setData(p=>({ ...p, cardNumber:v.replace(/\s/g,'') }))} />
          <Input ref={getInputRef('cardHolder')} label={t('card_holder')} placeholder={'JOHN DOE / 山田太郎'} value={data.cardHolder||''} onChangeText={v=> setData(p=>({ ...p, cardHolder:v }))} />
          <Input ref={getInputRef('expiry')} label={t('expiry_date')} placeholder={'MM/YY'} keyboardType='numeric' value={data.expiry||''} onChangeText={v=> setData(p=>({ ...p, expiry:v }))} />
          <Input ref={getInputRef('cvv')} label={'CVV'} placeholder={'***'} keyboardType='numeric' secure value={data.cvv||''} onChangeText={v=> setData(p=>({ ...p, cvv:v.replace(/\D/g,'').slice(0,3) }))} />
        </>
      );
    }
    if (type === 'usdt_trc20') {
      return (
        <>
          <Input ref={getInputRef('address')} label={t('usdt_address')} placeholder={'T... (TRC20)'} value={data.address||''} onChangeText={v=> setData(p=>({ ...p, address:v }))} />
        </>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={64}>
      <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }} keyboardShouldPersistTaps="always" keyboardDismissMode="interactive">
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
      {editingId && (
        <TouchableOpacity onPress={async ()=> { await setDefaultPaymentMethod(editingId); Alert.alert(t('success'), t('set_default_method_success') || '已设为默认'); navigation.goBack(); }} style={{ marginTop:12 }}>
          <Text style={{ color:'#1976D2', textAlign:'center' }}>{t('set_default_method') || '设为默认'}</Text>
        </TouchableOpacity>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
