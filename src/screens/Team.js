import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { computeTeamHierarchy, getMyInviteCode } from '../services/team';
import { getCurrentUsername } from '../services/auth';
import * as Clipboard from 'expo-clipboard';
import Toast from '../components/ui/Toast';

export default function Team() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [hier, setHier] = useState({ level1Count:0, level2Count:0, level3Count:0, totalMembers:0, level1Commission:0, level2Commission:0, level3Commission:0, totalCommission:0 });
  const [inviteCode, setInviteCode] = useState('');
  const [toast, setToast] = useState(false);

  const load = async () => {
    const u = await getCurrentUsername();
    const code = await getMyInviteCode();
    setInviteCode(code);
    if (u) {
      const h = await computeTeamHierarchy(u);
      setHier(h);
    }
  };

  useEffect(() => { load(); }, []);

  const copyInvite = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setToast(true);
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding: spacing.md }}>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>{t('my_team')}</Text>
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: 12 }}>
          <Text>{t('team_total')}: {hier.totalMembers}</Text>
          <Text>{t('total_commission')}: {hier.totalCommission.toFixed(6)} USDT</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text>{t('level1_commission')}: {hier.level1Count} 人 · {hier.level1Commission.toFixed(6)} USDT</Text>
          <Text style={{ marginTop: 6 }}>{t('level2_commission')}: {hier.level2Count} 人 · {hier.level2Commission.toFixed(6)} USDT</Text>
          <Text style={{ marginTop: 6 }}>{t('level3_commission')}: {hier.level3Count} 人 · {hier.level3Commission.toFixed(6)} USDT</Text>
        </View>
        <TouchableOpacity onPress={copyInvite} activeOpacity={0.8} style={{ marginTop: 14, backgroundColor:'#E3F2FD', paddingVertical:10, paddingHorizontal:14, borderRadius:8 }}>
          <Text style={{ color:'#1565C0', fontWeight:'600' }}>{t('copy_invitation_code')}: {inviteCode || '-'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 12, backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontWeight: '700' }}>{t('team_hierarchy_flow')}</Text>
        <Text style={{ marginTop: 6 }}>1. {t('share_invite_code')}</Text>
        <Text style={{ marginTop: 6 }}>2. {t('friend_register_fill')}</Text>
        <Text style={{ marginTop: 6 }}>3. {t('friend_order_commission')}</Text>
        <Text style={{ marginTop: 6 }}>4. {t('commission_withdrawable_realtime')}</Text>
      </View>
      <Toast visible={toast} message={t('copied_success')} onHide={() => setToast(false)} />
    </ScrollView>
  );
}
