import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { addPaymentMethod, getPaymentMethods, removePaymentMethod, validateMethod } from '../services/paymentMethods';

export default function PaymentMethodAdd(){
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [type] = useState('usdt_trc20'); // 默认 USDT TRC20（保留原入口）
  const [list, setList] = useState([]);
  const [data, setData] = useState({ cardNumber:'', cardHolder:'', expiry:'', address:'' });
  const renderCountRef = React.useRef(0);
  renderCountRef.current += 1;
  const inputRef = React.useRef(null);

  const load = async () => {
    const all = await getPaymentMethods();
    setList(all.filter(i => i.type === 'usdt_trc20'));
  };
  useEffect(()=>{ load(); },[]);

  const onSubmit = async () => {
    // Ensure inputs have blurred and local values synced to `data`
    try { Keyboard.dismiss(); } catch {}
    await new Promise(resolve => setTimeout(resolve, 120));
    // if InputWithLog ref exists, prefer its current value to avoid stale parent state
    const merged = { ...data };
    try {
      const v = inputRef?.current?.getValue?.();
      if (v !== undefined) merged.address = v;
    } catch {}
    const err = validateMethod({ type, data: merged });
    if (err) { Alert.alert(t('alert_title'), t(err) || err); return; }
    const payload = { type, data: merged };
    await addPaymentMethod(payload);
    await load();
    Alert.alert(t('submit_success') || '已保存');
  };

  const renderExisting = ({ item }) => (
    <View style={{ padding:12, borderWidth:1, borderColor:colors.divider, borderRadius:12, backgroundColor:'#fff', marginBottom:8 }}>
      <Text style={{ fontWeight:'700' }}>{t('method_usdt_trc20')}</Text>
      <Text style={{ marginTop:4, color:'#616161' }}>{item.data?.address}</Text>
      <TouchableOpacity onPress={async ()=>{ await removePaymentMethod(item.id); await load(); }} style={{ marginTop:8 }}>
        <Text style={{ color:'#D32F2F' }}>{t('delete') || '删除'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={64}>
    <ScrollView style={{ flex:1, backgroundColor:colors.background }} contentContainerStyle={{ padding: spacing.md }} keyboardShouldPersistTaps="always" keyboardDismissMode="interactive">
      <Text style={{ fontWeight:'700', marginBottom:8 }}>{t('add_payment_method') || '添加收款方式'}</Text>

      {/* 已有的方式（使用普通 View 渲染，避免嵌套可滚动组件导致的焦点问题） */}
      <View>
        {list.length === 0 ? (
          <Text style={{ color:'#757575' }}>{t('no_methods') || '暂无收款方式'}</Text>
        ) : (
          list.map(item => (
            <View key={item.id} style={{ padding:12, borderWidth:1, borderColor:colors.divider, borderRadius:12, backgroundColor:'#fff', marginBottom:8 }}>
              <Text style={{ fontWeight:'700' }}>{t('method_usdt_trc20')}</Text>
              <Text style={{ marginTop:4, color:'#616161' }}>{item.data?.address}</Text>
              <TouchableOpacity onPress={async ()=>{ await removePaymentMethod(item.id); await load(); }} style={{ marginTop:8 }}>
                <Text style={{ color:'#D32F2F' }}>{t('delete') || '删除'}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* 表单：仅 USDT TRC20 */}
      <View style={{ marginTop:12, backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:colors.divider, padding:12 }}>
        <Text>{t('usdt_address') || 'USDT地址(TRC20)'}</Text>
        {/* InputWithLog 帮助确认是否被重新 mount */}
        <InputWithLog
          ref={inputRef}
          value={data.address}
          onChangeText={(v)=> setData(prev=>({ ...prev, address:v }))}
          placeholder="T... (TRON)"
          style={{ height:44, borderWidth:1, borderColor:colors.border, borderRadius:8, paddingHorizontal:10, marginTop:6 }}
        />
      </View>

      <View style={{ marginTop:12 }}>
        <PrimaryButton title={t('save_method') || '保存'} onPress={onSubmit} />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const InputWithLog = React.forwardRef(function InputWithLog({ value, onChangeText, placeholder, style }, ref){
  const innerRef = React.useRef(null);
  const [localValue, setLocalValue] = React.useState(value || '');
  React.useEffect(() => {
    console.log('[InputWithLog] mounted');
    return () => console.log('[InputWithLog] unmounted');
  }, []);

  React.useEffect(() => { setLocalValue(value || ''); }, [value]);

  const handleChange = (v) => { console.log('[InputWithLog] onChangeText', v); setLocalValue(v); };
  const handleBlur = () => { console.log('[InputWithLog] blur final=', localValue); onChangeText?.(localValue); };

  React.useImperativeHandle(ref, () => ({
    getValue: () => localValue,
    blur: () => { try { innerRef.current && innerRef.current.blur(); } catch{} },
    focus: () => { try { innerRef.current && innerRef.current.focus(); } catch{} }
  }));

  return (
    <TextInput
      ref={innerRef}
      value={localValue}
      onChangeText={handleChange}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      blurOnSubmit={false}
      returnKeyType="done"
      onFocus={() => console.log('[InputWithLog] focus')}
      onBlur={handleBlur}
      style={style}
    />
  );
});

