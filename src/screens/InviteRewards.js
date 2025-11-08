import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { getMyInviteCode, getCommissionTotalsByLevel } from '../services/team';
import { getCurrentUsername } from '../services/auth';
import * as Clipboard from 'expo-clipboard';
import Toast from '../components/ui/Toast';

export default function InviteRewards({ navigation }) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [inviteCode, setInviteCode] = useState('');
  const [recent, setRecent] = useState([]);
  const [total, setTotal] = useState(0);
  const [username, setUsername] = useState('');
  const [toast, setToast] = useState(false);

  const load = async () => {
    const u = await getCurrentUsername();
    setUsername(u || '');
    const code = await getMyInviteCode();
    setInviteCode(code);
    const totals = await getCommissionTotalsByLevel(u || '');
    setTotal(Number(totals.total.toFixed(6)));
    setRecent(totals.recent || []);
  };

  useEffect(() => { load(); }, []);

  const copyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setToast(true);
  };

  return (
    <View style={{ flex:1, padding: spacing.md, backgroundColor: colors.background }}>
      {/* 邀请码卡片 */}
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontSize:18, fontWeight:'700' }}>{t('invite_rewards')}</Text>
        <Text style={{ marginTop:8, color:'#424242' }}>{t('invitation_code')}: {inviteCode || '-'}</Text>
        <TouchableOpacity onPress={copyCode} activeOpacity={0.8} style={{ marginTop:10, alignSelf:'flex-start', backgroundColor:'#E3F2FD', paddingVertical:8, paddingHorizontal:12, borderRadius:8 }}>
          <Text style={{ color:'#1565C0', fontWeight:'600' }}>{t('copy_invitation_code')}</Text>
        </TouchableOpacity>
      </View>

      {/* 规则说明 */}
      <View style={{ marginTop:12, backgroundColor:'#fff', padding:16, borderRadius:borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontWeight:'700' }}>{t('commission_rules')}</Text>
        <Text style={{ marginTop:6 }}>{t('level1_commission')}: 30%</Text>
        <Text style={{ marginTop:6 }}>{t('level2_commission')}: 15%</Text>
        <Text style={{ marginTop:6 }}>{t('level3_commission')}: 5%</Text>
        <Text style={{ marginTop:6, color:'#616161' }}>{t('commission_rules_desc')}</Text>
      </View>

      {/* 累计+最近明细 */}
      <View style={{ marginTop:12, backgroundColor:'#fff', padding:16, borderRadius:borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontWeight:'700' }}>{t('total_commission')}: {total.toFixed(6)} USDT</Text>
        <Text style={{ marginTop:10, fontWeight:'600' }}>{t('recent_commissions')}</Text>
        {recent.length === 0 ? (
          <Text style={{ marginTop:6, color:'#9E9E9E' }}>{t('empty_state')}</Text>
        ) : recent.map((c)=> (
          <View key={c.id} style={{ marginTop:8, padding:12, borderRadius:8, borderWidth:1, borderColor: colors.divider }}>
            <Text>{t('amount')}: {c.amountUSDT} USDT</Text>
            <Text style={{ marginTop:4 }}>{t('from_user')}: {c.fromUsername} · L{c.level}</Text>
            <Text style={{ marginTop:4, color:'#757575' }}>{new Date(c.createdAt).toLocaleString()}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={() => navigation.navigate('CommissionDetails')} activeOpacity={0.85} style={{ marginTop:12, alignSelf:'flex-start', backgroundColor:'#E3F2FD', paddingVertical:8, paddingHorizontal:12, borderRadius:8 }}>
          <Text style={{ color:'#1565C0', fontWeight:'600' }}>{t('view_all')}</Text>
        </TouchableOpacity>
      </View>
      <Toast visible={toast} message={t('copied_success')} onHide={() => setToast(false)} />
    </View>
  );
}
