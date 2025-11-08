import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { isValidUSDTAddress } from '../utils/validators';
import { getWalletAddressInfo, submitWalletAddress, saveWalletAddressInfo, approveWalletAddress } from '../services/assets';
import { useI18n } from '../context/I18nContext';
import { useNavigation } from '@react-navigation/native';

export default function PaymentAddress() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const navigation = useNavigation();
  const [form, setForm] = useState({ network: 'TRC20', address: '', label: '' });
  const [status, setStatus] = useState('not_submitted'); // not_submitted | pending_review | approved

  const validMsg = useMemo(() => {
    if (!form.address) return '';
    const ok = isValidUSDTAddress({ network: form.network, address: form.address.trim() });
    if (ok) return t('format_ok');
    if (form.network === 'TRC20') return t('format_error_trc20');
    if (form.network === 'ERC20') return t('format_error_erc20');
    return t('format_error');
  }, [form, t]);

  const load = async () => {
    const info = await getWalletAddressInfo();
    setForm({ network: info.network || 'TRC20', address: info.address || '', label: info.label || '' });
    setStatus(info.status || 'not_submitted');
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async () => {
    const ok = isValidUSDTAddress({ network: form.network, address: form.address.trim() });
  if (!ok) { Alert.alert(t('validation_failed'), t('invalid_address_format_for_network', { network: form.network })); return; }

    if (status === 'approved') {
      Alert.alert(t('confirm_change_address_title'), t('confirm_change_address_desc'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirm'), onPress: async () => {
          await submitWalletAddress({ ...form, address: form.address.trim() });
          setStatus('pending_review');
          Alert.alert(t('submitted_title'), t('resubmitted_desc'));
        }}
      ]);
      return;
    }

    await submitWalletAddress({ ...form, address: form.address.trim() });
    setStatus('pending_review');
    Alert.alert(t('submitted_title'), t('submitted_desc'));
  };

  const setNetwork = async (net) => {
    setForm(prev => ({ ...prev, network: net }));
    await saveWalletAddressInfo({ network: net });
  };

  const StatusBadge = () => {
    let text = t('address_not_submitted');
    let color = '#9E9E9E';
    if (status === 'pending_review') { text = t('address_status_pending'); color = '#FB8C00'; }
    if (status === 'approved') { text = t('address_status_passed'); color = '#43A047'; }
    return (
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: color }}>
        <Text style={{ color }}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.md }}>
      {/* 指南 */}
      <View style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 12, borderWidth: 1, borderColor: colors.divider }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>{t('payment_address_guide_title')}</Text>
        <Text>🔗 {t('chain_type_tron_default')}</Text>
        <Text style={{ marginTop: 4 }}>{t('guide_step_select_chain')}</Text>
        <Text>{t('guide_step_paste_address')}</Text>
        <Text>{t('guide_step_review_time')}</Text>
      </View>

      {/* 表单 */}
      <View style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 12, borderWidth: 1, borderColor: colors.divider, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '700' }}>{t('payment_address_settings')}</Text>
          <StatusBadge />
        </View>

        <View style={{ marginTop: 12 }}>
          <Text>{t('chain_type')}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            {['TRC20','ERC20'].map(net => (
              <TouchableOpacity key={net} onPress={() => setNetwork(net)} activeOpacity={0.8}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: form.network===net? colors.primary : colors.border, backgroundColor: form.network===net? '#E3F2FD' : '#FAFAFA' }}>
                <Text style={{ color: form.network===net? colors.primary : '#424242' }}>{net}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text>{t('usdt_address_label')}</Text>
          <TextInput
            value={form.address}
            onChangeText={(v)=> setForm(prev => ({ ...prev, address: v }))}
            placeholder={form.network==='TRC20' ? t('placeholder_trc20') : t('placeholder_erc20')}
            autoCapitalize="none"
            style={{ backgroundColor: '#fafafa', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, height: 44, marginTop: 6 }}
          />
          {!!validMsg && (
            <Text style={{ marginTop: 6, color: validMsg===t('format_ok') ? '#43A047' : '#E53935' }}>{validMsg}</Text>
          )}
        </View>

        <View style={{ marginTop: 12 }}>
          <Text>{t('remark_optional')}</Text>
          <TextInput value={form.label} onChangeText={(v)=>setForm({ ...form, label: v })} placeholder=""
            style={{ backgroundColor: '#fafafa', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, height: 44, marginTop: 6 }} />
        </View>

        {status === 'pending_review' && (
          <Text style={{ marginTop: 10, color: '#FB8C00' }}>{t('submitted_pending_review')}</Text>
        )}
        {status === 'approved' && (
          <Text style={{ marginTop: 10, color: '#43A047' }}>{t('approved_tip')}</Text>
        )}

        <View style={{ marginTop: 14 }}>
          <PrimaryButton title={status==='approved' ? t('revise_and_resubmit') : t('submit_address')} onPress={onSubmit} />
        </View>

        {status === 'pending_review' && (
          <TouchableOpacity onPress={async ()=> { await approveWalletAddress(); setStatus('approved'); Alert.alert('TEST', 'Mock approved'); }} style={{ marginTop: 8 }}>
            <Text style={{ color: '#9E9E9E', textAlign: 'center' }}>{t('test_approve_mock')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 添加收款方式入口 */}
      <View style={{ marginTop: 12 }}>
        <TouchableOpacity onPress={()=> navigation.navigate('PaymentMethodAdd')} style={{ alignSelf:'flex-start' }}>
          <Text style={{ color:'#1976D2' }}>+ {t('add_payment_method')}</Text>
        </TouchableOpacity>
      </View>

      {/* 其他说明 */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ marginBottom: 6, color: '#757575' }}>{t('auto_match_deposit_title')}</Text>
        <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.divider }}>
          <Text>{t('auto_match_point1')}</Text>
          <Text>{t('auto_match_point2')}</Text>
          <Text>{t('auto_match_point3')}</Text>
        </View>
      </View>
    </View>
  );
}
