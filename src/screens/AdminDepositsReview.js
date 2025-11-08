import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TextInput, Alert, ScrollView } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { listDeposits, approveDeposit, rejectDeposit } from '../services/deposits';
import * as log from '../services/log';
import { getCurrentUsername } from '../services/auth';
import PrimaryButton from '../components/ui/PrimaryButton';
import useAdminGuard from '../hooks/useAdminGuard';

export default function AdminDepositsReview({ navigation }){
  const { t } = useI18n();
  const { colors, borderRadius } = useTheme();
  const allowed = useAdminGuard(navigation);
  const [list, setList] = useState([]);
  const [reviewAmounts, setReviewAmounts] = useState({});
  const [reviewRemarks, setReviewRemarks] = useState({});

  const load = async () => {
    const data = await listDeposits({ status: 'pending' });
    setList(data);
  };
  useEffect(()=>{ if (allowed) load(); },[allowed]);

  const onApprove = async (item) => {
    const reviewer = await getCurrentUsername();
    const amt = Number(reviewAmounts[item.id] ?? item.amountRequestedUSDT) || 0;
    await approveDeposit(item.id, { amountApprovedUSDT: amt, reviewerUsername: reviewer, noteAdmin: reviewRemarks[item.id] || '' });
    Alert.alert(t('submitted_title'), t('deposit_approved'));
    try { log.info('deposit_approved', { depositId: item.id, reviewer, amountApprovedUSDT: amt }); } catch {}
    await load();
  };
  const onReject = async (item) => {
    const reviewer = await getCurrentUsername();
    await rejectDeposit(item.id, { reviewerUsername: reviewer, noteAdmin: reviewRemarks[item.id] || '' });
    Alert.alert(t('submitted_title'), t('deposit_rejected'));
    try { log.info('deposit_rejected', { depositId: item.id, reviewer }); } catch {}
    await load();
  };

  const renderItem = ({ item }) => (
    <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12, marginBottom:12 }}>
      <Text style={{ fontWeight:'700' }}>{item.username}</Text>
      <Text style={{ marginTop:4, color:'#616161' }}>{t('deposit_amount')}: {item.amountRequestedUSDT} USDT</Text>
      {item.proofImage ? <Image source={{ uri: item.proofImage }} style={{ width:'100%', height:220, borderRadius:8, marginTop:8 }} /> : null}
      <Text style={{ marginTop:8 }}>{t('approved_amount')}</Text>
      <TextInput value={String(reviewAmounts[item.id] ?? item.amountRequestedUSDT)} onChangeText={(v)=> setReviewAmounts(prev=>({ ...prev, [item.id]: v }))} keyboardType='numeric' style={{ height:40, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, marginTop:6 }} />
      <Text style={{ marginTop:8 }}>{t('review_remark')}</Text>
      <TextInput value={reviewRemarks[item.id] || ''} onChangeText={(v)=> setReviewRemarks(prev=>({ ...prev, [item.id]: v }))} placeholder='' style={{ height:40, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, marginTop:6 }} />
      <View style={{ flexDirection:'row', gap:12, marginTop:12 }}>
        <PrimaryButton title={t('approve')} onPress={()=> onApprove(item)} />
        <PrimaryButton title={t('reject')} onPress={()=> onReject(item)} style={{ backgroundColor:'#E53935' }} />
      </View>
    </View>
  );

  if (!allowed) return null;
  return (
    <ScrollView style={{ flex:1, padding:12, backgroundColor:'#F7F7F7' }}>
      {list.length === 0 ? (
        <Text style={{ color:'#757575', textAlign:'center', marginTop:20 }}>{t('no_deposits')}</Text>
      ) : (
        <FlatList data={list} keyExtractor={(i)=>i.id} renderItem={renderItem} scrollEnabled={false} />
      )}
    </ScrollView>
  );
}
