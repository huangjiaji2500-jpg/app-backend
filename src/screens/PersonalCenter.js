import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAssetSnapshot, getWalletAddressInfo } from '../services/assets';
import { logout, getCurrentUsername, isCurrentUserAdmin, promoteCurrentUserToAdmin, anyAdminExists } from '../services/auth';
import { useI18n } from '../context/I18nContext';

function buildGrid(t, isAdmin){
  const items = [
    // 按需求：汇率设置仅在后台出现，这里不再展示
    { key: t('grid_language_settings'), icon: 'globe-outline', route: 'LanguageSettings' },
    { key: t('grid_my_team'), icon: 'people-outline', route: 'Team' },
    // 支付方式管理仅普通用户可见
    ...(isAdmin ? [] : [{ key: t('manage_payment_methods'), icon: 'card-outline', route: 'PaymentMethodManager' }]),
    { key: t('grid_my_messages'), icon: 'chatbubble-ellipses-outline', route: 'Messages' },
    { key: t('grid_invite_rewards'), icon: 'gift-outline', route: 'InviteRewards' },
    { key: t('grid_income_records'), icon: 'reader-outline', route: 'IncomeRecords' },
    { key: t('grid_earnings_details'), icon: 'pie-chart-outline', route: 'EarningsDetails' },
    { key: t('grid_transfer_records'), icon: 'swap-vertical-outline', route: 'TransferRecords' },
    { key: t('grid_contact_us'), icon: 'call-outline', route: 'ContactUs' },
    { key: t('grid_faq'), icon: 'help-circle-outline', route: '资讯中心' },
    { key: t('grid_about_us'), icon: 'information-circle-outline', route: 'AboutUs' },
  { key: t('recharge'), icon: 'add-circle-outline', route: 'Recharge' },
  ];
  return items;
}

export default function PersonalCenter({ navigation }) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState({ balanceUSDT:0, commissionTotalUSDT:0, withdrawableUSDT:0, walletStatus:'not_submitted', availableBalanceUSDT:0 });
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [promoteError, setPromoteError] = useState('');
  const [grid, setGrid] = useState(buildGrid(t, false));

  const load = async () => {
    const snap = await getAssetSnapshot();
    setSnapshot(snap);
    const u = await getCurrentUsername();
    setUsername(u || '未登录');
    setIsAdmin(await isCurrentUserAdmin());
    setHasAdmin(await anyAdminExists());
  };
  const onPromote = async () => {
    setPromoteError('');
    try {
      const result = await promoteCurrentUserToAdmin({ code: 'usdtapp-admin-001' });
      if (result.ok) {
        Alert.alert('成功', '已升级为管理员');
        setIsAdmin(true);
      }
    } catch (e) {
      setPromoteError(e.message || '升级失败');
    }
  };

  useEffect(() => { const unsub = navigation.addListener('focus', load); load(); return unsub; }, [navigation]);
  useEffect(() => { setGrid(buildGrid(t, isAdmin)); }, [t, isAdmin]);

  const renderGrid = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        if (item.route === '资讯中心') {
          navigation.navigate('MainTabs', { screen: '资讯中心' });
          return;
        }
        if (item.route) navigation.navigate(item.route);
      }}
      style={{ width: '25%', paddingVertical: 16, alignItems: 'center' }}
      activeOpacity={0.8}
    >
      <Ionicons name={item.icon} size={24} color={colors.primary} />
      <Text style={{ marginTop: 6, color: '#424242', fontSize: 12 }}>{item.key}</Text>
    </TouchableOpacity>
  );

  const onLogout = () => {
    Alert.alert(t('alert_title'), t('logout_confirm_message') || '退出后需要重新输入用户名和密码', [
      { text: t('cancel') || '取消', style: 'cancel' },
      { text: t('confirm') || '确认', onPress: async () => { await logout(); navigation.reset({ index:0, routes:[{ name:'Login' }]}); } }
    ]);
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* 顶部数据卡片 */}
      <View style={{ margin: spacing.md }}>
        <View style={{ flexDirection:'row', gap:12 }}>
          <View style={{ flex:1, backgroundColor:'#fff', borderRadius:borderRadius.lg, padding:12, borderWidth:1, borderColor: colors.divider }}>
            <Text style={{ color:'#757575' }}>{t('my_assets')}</Text>
            <Text style={{ fontSize:22, fontWeight:'700', marginTop:4, color: colors.primary }}>{(snapshot.availableBalanceUSDT||0).toFixed(2)} USDT</Text>
          </View>
          <View style={{ flex:1, backgroundColor:'#fff', borderRadius:borderRadius.lg, padding:12, borderWidth:1, borderColor: colors.divider }}>
            <Text style={{ color:'#757575' }}>{t('withdrawable_amount')}</Text>
            <Text style={{ fontSize:22, fontWeight:'700', marginTop:4, color: snapshot.walletStatus==='approved'? colors.primary :'#BDBDBD' }}>{snapshot.withdrawableUSDT.toFixed(2)} USDT</Text>
          </View>
          <View style={{ flex:1, backgroundColor:'#fff', borderRadius:borderRadius.lg, padding:12, borderWidth:1, borderColor: colors.divider }}>
            <Text style={{ color:'#757575' }}>{t('team_total_commission')}</Text>
            <Text style={{ fontSize:22, fontWeight:'700', marginTop:4, color: colors.primary }}>{snapshot.commissionTotalUSDT.toFixed(2)} USDT</Text>
          </View>
        </View>
        <Text style={{ marginTop:8, fontSize:12, color:'#757575' }}>{t('address_status')}：{snapshot.walletStatus === 'approved' ? t('address_status_passed') : snapshot.walletStatus === 'pending_review' ? t('address_status_pending') : t('address_not_submitted')}</Text>
        <Text style={{ marginTop:2, fontSize:12, color:'#757575' }}>{t('current_user')}：{username}</Text>
      </View>

      {/* 功能入口网格 */}
      <View style={{ marginHorizontal: spacing.md, backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
  <FlatList data={grid} numColumns={4} keyExtractor={(i)=>i.key} renderItem={renderGrid} scrollEnabled={false} />
      </View>

      {/* 地址管理快捷入口 */}
      <View style={{ margin: spacing.md }}>
  <PrimaryButton title={t('manage_payment_address')} onPress={() => navigation.navigate('PaymentAddress')} />
      </View>

      {/* 后台入口（仅管理员可见） */}
      {isAdmin && (
        <View style={{ marginHorizontal: spacing.md }}>
          <PrimaryButton title={t('admin_management') || '后台管理'} onPress={() => navigation.navigate('AdminDashboard')} />
        </View>
      )}
      {!isAdmin && !hasAdmin && (
        <View style={{ marginHorizontal: spacing.md }}>
          <PrimaryButton title={t('become_first_admin') || '成为首位管理员'} onPress={onPromote} />
          {promoteError ? <Text style={{ color:'#D32F2F', marginTop:4 }}>{promoteError}</Text> : null}
        </View>
      )}
      {/* 已存在管理员后不再暴露解锁码入口，提升安全性 */}
      {!isAdmin && hasAdmin && null}

      {/* 退出登录 */}
      <View style={{ marginHorizontal: spacing.md }}>
  <PrimaryButton title={t('logout_btn')} onPress={onLogout} style={{ backgroundColor:'#E53935' }} />
      </View>
    </ScrollView>
  );
}
