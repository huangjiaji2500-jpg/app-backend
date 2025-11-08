import React, { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { getPlatformDepositAddress } from '../services/platformDeposit';
import { addDepositRequest } from '../services/deposits';

export default function Recharge({ navigation }){
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [platform, setPlatform] = useState({ address:'', qrImage:'', note:'' });
  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState('');

  useEffect(()=>{ (async()=>{ const cfg = await getPlatformDepositAddress(); setPlatform(cfg); })(); },[]);

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(platform.address || '');
      Alert.alert(t('alert_title'), t('copied_success'));
    } catch { Alert.alert(t('alert_title'), platform.address); }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert(t('alert_title'), 'Permission denied'); return; }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7, selectionLimit: 1 });
    if (!res.canceled && res.assets && res.assets[0]) {
      const a = res.assets[0];
      if (a.base64) setProof(`data:${a.mimeType||'image/jpeg'};base64,${a.base64}`);
    }
  };

  const onSubmit = async () => {
    const amt = Number(amount) || 0;
    if (!platform.address) { Alert.alert(t('alert_title'), t('company_deposit_address')); return; }
    if (amt <= 0) { Alert.alert(t('alert_title'), t('amount_placeholder')); return; }
    if (!proof) { Alert.alert(t('alert_title'), t('proof_required')); return; }
    await addDepositRequest({ amountRequestedUSDT: amt, proofImage: proof });
    Alert.alert(t('submitted_title'), t('deposit_pending_review'));
    navigation.goBack();
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12 }}>
        <Text style={{ fontWeight:'700', fontSize:16 }}>{t('recharge')}</Text>
        <View style={{ alignItems:'center', marginTop:12 }}>
          {platform.qrImage ? (
            <Image source={{ uri: platform.qrImage }} style={{ width:220, height:220, borderRadius:12 }} />
          ) : (
            <View style={{ width:220, height:220, borderRadius:12, backgroundColor:'#E0E0E0', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:'#9E9E9E' }}>QR</Text>
            </View>
          )}
          <Text style={{ marginTop:8, fontSize:12, color:'#424242' }}>{platform.address || '-'}</Text>
          <TouchableOpacity onPress={onCopy} style={{ marginTop:8 }}><Text style={{ color:'#1976D2' }}>{t('copy_address')}</Text></TouchableOpacity>
          <Text style={{ marginTop:8, fontSize:12, color:'#9E9E9E' }}>{t('only_accept_trc20')}</Text>
        </View>
      </View>

      <View style={{ marginTop:12, backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12 }}>
        <Text>{t('deposit_amount')} (USDT)</Text>
        <View style={{ flexDirection:'row', alignItems:'center', marginTop:6, borderWidth:1, borderColor: colors.border, borderRadius:8, overflow:'hidden', backgroundColor:'#FAFAFA' }}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType='numeric'
            placeholder={t('amount_placeholder')}
            style={{ height:44, paddingHorizontal:10, flex:1 }}
          />
          <View style={{ paddingHorizontal:10 }}>
            <Text style={{ color:'#616161', fontWeight:'600' }}>USDT</Text>
          </View>
        </View>
        <Text style={{ marginTop:12 }}>{t('upload_proof')}</Text>
        {proof ? <Image source={{ uri: proof }} style={{ width:'100%', height:200, borderRadius:8, marginTop:6 }} /> : null}
        <TouchableOpacity onPress={pickImage} style={{ marginTop:8 }}>
          <Text style={{ color:'#1976D2' }}>{proof ? t('upload_proof') : t('upload_proof')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop:12 }}>
        <PrimaryButton title={t('submit_deposit_request')} onPress={onSubmit} />
      </View>
    </ScrollView>
  );
}
