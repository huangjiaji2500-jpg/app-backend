import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, ScrollView, TextInput, TouchableOpacity, Image, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { getAllUsers, getAllOrders, getAllCommissions } from '../services/admin';
import { isCurrentUserAdmin } from '../services/auth';
import useAdminGuard from '../hooks/useAdminGuard';
import { getPlatformDepositAddress, savePlatformDepositAddress } from '../services/platformDeposit';
import { getMinOrderAmount, setMinOrderAmount, DEFAULT_PLATFORM_CONFIG } from '../services/platformConfig';
import { ORDER_STATUS } from '../services/orders';
import { fetchRemoteLatest, forceRetrySync } from '../services/remoteSync';

export default function AdminDashboard({ navigation }) {
  const { colors, borderRadius, spacing } = useTheme();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [remoteOrders, setRemoteOrders] = useState([]);
  const [remoteDeposits, setRemoteDeposits] = useState([]);
  const [depositAddress, setDepositAddress] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [depositQR, setDepositQR] = useState('');
  const [showBase64, setShowBase64] = useState(false);
  // 初始值引用集中默认配置，避免散落硬编码
  const [minOrderAmount, setMinOrderAmountState] = useState(DEFAULT_PLATFORM_CONFIG.minOrderAmount);
  const pickImageWithPermission = async () => {
    try {
      let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!perm?.granted) {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!perm?.granted) {
        Alert.alert(t('alert_title'), t('media_permission_denied'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('open_settings'), onPress: () => Linking.openSettings && Linking.openSettings() },
        ]);
        return null;
      }
  // SDK 54 / expo-image-picker v15 在部分设备上要求 mediaTypes 为数组
  let res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.8, selectionLimit: 1 });
      if (!res.canceled && res.assets && res.assets[0]) {
        const a = res.assets[0];
        return `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}`;
      }
      return null;
    } catch (e) {
      Alert.alert(t('alert_title'), e?.message || 'Image picker error');
      return null;
    }
  };

  const allowed = useAdminGuard(navigation);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const [u, o, c, cfg, min, remote] = await Promise.all([
        getAllUsers(),
        getAllOrders(),
        getAllCommissions(),
        getPlatformDepositAddress(),
        getMinOrderAmount(),
        fetchRemoteLatest().catch(()=>({ orders:[], deposits:[] })),
      ]);
      setUsers(u);
      setOrders(o);
      setCommissions(c);
      setDepositAddress(cfg.address || '');
      setDepositNote(cfg.note || '');
    setDepositQR(cfg.qrImage || '');
    setMinOrderAmountState(Number(min) || DEFAULT_PLATFORM_CONFIG.minOrderAmount);
    setRemoteOrders(Array.isArray(remote.orders)? remote.orders : []);
    setRemoteDeposits(Array.isArray(remote.deposits)? remote.deposits : []);
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const Section = ({ title, children }) => (
    <View style={{ backgroundColor:'#fff', borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12, marginBottom:12 }}>
      <Text style={{ fontWeight:'700', fontSize:16, marginBottom:8 }}>{title}</Text>
      {children}
    </View>
  );

  if (!allowed) {
    return null; // 等待守卫判定或已跳转
  }
  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
  <Section title={t('company_deposit_address')}>
        <Text style={{ color:'#666', marginBottom:4 }}>{t('only_accept_trc20')}</Text>
        <Text style={{ fontSize:12, color:'#999' }}>{t('upload_proof')} (在用户充值页)</Text>
        <Text style={{ marginTop:8, fontWeight:'600' }}>USDT(TRC20) {t('company_deposit_address')}</Text>
        <TextInput
          value={depositAddress}
          onChangeText={setDepositAddress}
          placeholder='T...'
          style={{ marginTop:6, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, height:44, backgroundColor:'#FAFAFA' }}
        />
        <Text style={{ marginTop:12 }}>{t('review_remark')}</Text>
        <TextInput
          value={depositNote}
          onChangeText={setDepositNote}
          placeholder='Note'
          style={{ marginTop:6, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, height:40, backgroundColor:'#FAFAFA' }}
        />
        <Text style={{ marginTop:12 }}>QR (base64)</Text>
        {depositQR ? (
          <Image source={{ uri: depositQR }} style={{ width: 160, height: 160, marginTop:6, borderRadius:8, alignSelf:'flex-start' }} />
        ) : null}
        <TouchableOpacity onPress={()=> setShowBase64(s=>!s)} style={{ marginTop:8 }}>
          <Text style={{ color:'#1976D2' }}>{showBase64 ? t('hide_base64') : t('view_or_paste_base64')}</Text>
        </TouchableOpacity>
        {showBase64 ? (
          <View style={{ marginTop:6 }}>
            <Text style={{ color:'#757575', fontSize:12 }}>{t('base64_hint')}</Text>
            <TextInput
              value={depositQR}
              onChangeText={setDepositQR}
              placeholder='data:image/png;base64,...'
              multiline
              style={{ marginTop:6, borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, minHeight:80, maxHeight:140, backgroundColor:'#FAFAFA', textAlignVertical:'top' }}
            />
          </View>
        ) : null}
        <TouchableOpacity
          onPress={async ()=>{
            const dataUrl = await pickImageWithPermission();
            if (dataUrl) setDepositQR(dataUrl);
          }}
          style={{ marginTop:8 }}
        >
          <Text style={{ color:'#1976D2' }}>{t('choose_qr_from_album')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            try {
              await savePlatformDepositAddress({ address: depositAddress, qrImage: depositQR, note: depositNote });
              Alert.alert(t('submitted_title'), t('save'));
            } catch (e) {
              Alert.alert(t('error'), e?.message || t('save_failed'));
            }
          }}
          style={{ marginTop:12, paddingVertical:10, backgroundColor: colors.primary, borderRadius:8 }}
        >
          <Text style={{ color:'#fff', textAlign:'center', fontWeight:'600' }}>{t('save')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminDepositsReview')}
          style={{ marginTop:12, paddingVertical:10, backgroundColor: '#1976D2', borderRadius:8 }}
        >
          <Text style={{ color:'#fff', textAlign:'center', fontWeight:'600' }}>{t('deposits_review')}</Text>
        </TouchableOpacity>
      </Section>
      <Section title={t('remote_data_panel') || '远端数据'}>
        <Text style={{ color:'#666' }}>{t('remote_orders') || '订单'}: {remoteOrders.length}</Text>
        <Text style={{ color:'#666', marginTop:4 }}>{t('remote_deposits') || '充值'}: {remoteDeposits.length}</Text>
        <TouchableOpacity onPress={async ()=>{ const r = await fetchRemoteLatest(); setRemoteOrders(r.orders||[]); setRemoteDeposits(r.deposits||[]); }} style={{ marginTop:8 }}>
          <Text style={{ color:'#1976D2' }}>{t('refresh_remote') || '刷新远端'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=> forceRetrySync()} style={{ marginTop:6 }}>
          <Text style={{ color:'#1976D2' }}>{t('retry_sync') || '重试未送达'}</Text>
        </TouchableOpacity>
      </Section>
  <Section title={`${t('users')}（${users.length}）`}>
        {users.length === 0 ? <Text style={{ color:'#999' }}>{t('empty_state')}</Text> : (
          <View>
            {users.map((u, idx) => (
              <View key={idx} style={{ paddingVertical:8, borderTopWidth: idx===0?0:1, borderColor: colors.divider }}>
                <Text style={{ fontWeight:'600' }}>{u.username} {u.isAdmin ? `· ${t('administrator')}` : ''}</Text>
                <Text style={{ color:'#666', fontSize:12 }}>UID: {u.firebaseUid}</Text>
                <Text style={{ color:'#666', fontSize:12 }}>{t('invite_code_label')}: {u.inviteCode || '-'}</Text>
                <Text style={{ color:'#666', fontSize:12 }}>{t('inviter_code_label')}: {u.inviterCode || '-'}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
      <Section title={t('min_order_amount_label')}>
        <Text style={{ color:'#666', fontSize:12, marginBottom:6 }}>{t('min_order_amount_hint')}</Text>
        <TextInput
          value={String(minOrderAmount)}
          onChangeText={(txt)=> setMinOrderAmountState(txt.replace(/[^0-9]/g,''))}
          keyboardType='numeric'
          style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, height:44, backgroundColor:'#FAFAFA' }}
        />
        <TouchableOpacity
          onPress={async ()=>{
            const v = Number(minOrderAmount);
            if (!Number.isInteger(v) || v < 1) { Alert.alert(t('error'), t('min_order_amount_invalid')); return; }
            try {
              await setMinOrderAmount(v);
              Alert.alert(t('success'), t('min_order_amount_saved'));
            } catch(e){
              Alert.alert(t('error'), e?.message || t('save_failed'));
            }
          }}
          style={{ marginTop:12, paddingVertical:10, backgroundColor: colors.primary, borderRadius:8 }}
        >
          <Text style={{ color:'#fff', textAlign:'center', fontWeight:'600' }}>{t('save')}</Text>
        </TouchableOpacity>
      </Section>

      <Section title={`${t('orders')}（${orders.length}）`}>
        {(() => {
          const counts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
          const [filter, setFilter] = React.useState('all');
          const rank = (s) => {
            const priority = {
              [ORDER_STATUS.PENDING_ADMIN_REVIEW]: 1,
              [ORDER_STATUS.APPROVED_PAYOUT]: 2,
              [ORDER_STATUS.REJECTED_PAYOUT]: 3,
              [ORDER_STATUS.COMPLETED]: 9,
            };
            return priority[s] || 8;
          };
          const statusColor = (s) => {
            if (s === ORDER_STATUS.PENDING_ADMIN_REVIEW) return '#EF6C00';
            if (s === ORDER_STATUS.APPROVED_PAYOUT) return '#1E88E5';
            if (s === ORDER_STATUS.REJECTED_PAYOUT) return '#E53935';
            if (s === ORDER_STATUS.COMPLETED) return '#2E7D32';
            return '#424242';
          };
          const base = filter === 'all' ? orders.slice() : orders.filter(o => o.status === filter).slice();
          const filtered = base.sort((a,b)=> {
            const ra = rank(a.status), rb = rank(b.status);
            if (ra !== rb) return ra - rb;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          return (
            <View>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 }}>
                {[
                  { key: 'all', label: t('all'), count: orders.length },
                  { key: ORDER_STATUS.PENDING_ADMIN_REVIEW, label: t('pending_admin_review'), count: counts[ORDER_STATUS.PENDING_ADMIN_REVIEW] || 0 },
                  { key: ORDER_STATUS.APPROVED_PAYOUT, label: t('approved_payout'), count: counts[ORDER_STATUS.APPROVED_PAYOUT] || 0 },
                  { key: ORDER_STATUS.REJECTED_PAYOUT, label: t('rejected_payout'), count: counts[ORDER_STATUS.REJECTED_PAYOUT] || 0 },
                  { key: ORDER_STATUS.COMPLETED, label: t('completed'), count: counts[ORDER_STATUS.COMPLETED] || 0 },
                ].map(item => (
                  <TouchableOpacity key={item.key} onPress={()=> setFilter(item.key)} style={{ paddingVertical:6, paddingHorizontal:10, borderRadius:16, borderWidth:1, borderColor: filter===item.key? colors.primary: colors.border, backgroundColor: filter===item.key? '#E3F2FD':'#fff' }}>
                    <Text style={{ color: filter===item.key? colors.primary: '#424242', fontSize:12 }}>{item.label}（{item.count}）</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {filtered.length === 0 ? <Text style={{ color:'#999' }}>{t('empty_state')}</Text> : (
                <View>
                  {filtered.map((o, idx) => (
                    <TouchableOpacity key={o.id || idx} onPress={()=> navigation.navigate('AdminOrderDetail', { orderId: o.id })} style={{ paddingVertical:8, borderTopWidth: idx===0?0:1, borderColor: colors.divider }}>
                      <Text style={{ fontWeight:'700', color: statusColor(o.status) }}>{t(o.status) || o.status}</Text>
                      <Text style={{ color:'#757575', fontSize:12, marginTop:2 }}>{new Date(o.createdAt).toLocaleString()}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('current_user')}: {o.creatorUsername || '-'}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('amount')}: {o.amountUSDT} USDT · {t('unit_price')} ${o.unitPrice} = {o.totalUSD !== undefined ? `$${o.totalUSD}` : `¥${o.totalCNY}`}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('order_id_label')}: {o.id}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })()}
      </Section>

      <Section title={`${t('commissions_label')}（${commissions.length}）`}>
        {commissions.length === 0 ? <Text style={{ color:'#999' }}>{t('empty_state')}</Text> : (
          <View>
            {commissions.map((c, idx) => (
              <View key={c.id || idx} style={{ paddingVertical:8, borderTopWidth: idx===0?0:1, borderColor: colors.divider }}>
                <Text style={{ fontWeight:'600' }}>L{c.level} · {new Date(c.createdAt).toLocaleString()}</Text>
                <Text style={{ color:'#666', fontSize:12 }}>{t('beneficiary')}: {c.toUsername} · {t('from_source')}: {c.fromUsername}</Text>
                <Text style={{ color:'#666', fontSize:12 }}>{t('amount')}: {c.amountUSDT} USDT · {t('order_id_label')}: {c.orderId}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </ScrollView>
  );
}