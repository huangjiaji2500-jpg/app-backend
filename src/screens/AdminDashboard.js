import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, ScrollView, TextInput, TouchableOpacity, Image, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { getAllUsers, getAllOrders, getAllCommissions, exportUsersCsv } from '../services/admin';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { isCurrentUserAdmin } from '../services/auth';
import useAdminGuard from '../hooks/useAdminGuard';
import { getPlatformDepositAddress, savePlatformDepositAddress } from '../services/platformDeposit';
import { getMinOrderAmount, setMinOrderAmount, DEFAULT_PLATFORM_CONFIG } from '../services/platformConfig';
import { ORDER_STATUS } from '../services/orders';
import { fetchRemoteLatest, forceRetrySync, mergeRemoteData, getSyncDiagnostics, discardQueueItem, retryQueueItem } from '../services/remoteSync';

export default function AdminDashboard({ navigation }) {
  const { colors, borderRadius, spacing } = useTheme();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userSortKey, setUserSortKey] = useState('registeredAt'); // registeredAt | lastLoginAt | balanceUSDT | directChildren
  const [userSortOrder, setUserSortOrder] = useState('desc'); // asc | desc
  const [orders, setOrders] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tempResetInfo, setTempResetInfo] = useState(null);
  const [remoteOrders, setRemoteOrders] = useState([]);
  const [remoteDeposits, setRemoteDeposits] = useState([]);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [remotePaymentMethods, setRemotePaymentMethods] = useState([]);
  const [remoteRates, setRemoteRates] = useState([]);
  const [remotePlatformDeposit, setRemotePlatformDeposit] = useState(null);
  const [lastRemoteSync, setLastRemoteSync] = useState(null);
  // 同步队列诊断状态
  const [syncDiag, setSyncDiag] = useState({ queue: [], history: [] });
  const [showQueue, setShowQueue] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const refreshDiag = useCallback(async () => {
    try { const d = await getSyncDiagnostics(); setSyncDiag(d); } catch {}
  }, []);
  const [depositAddress, setDepositAddress] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [depositQR, setDepositQR] = useState('');
  const [showBase64, setShowBase64] = useState(false);
  // 初始值引用集中默认配置，避免散落硬编码
  const [minOrderAmount, setMinOrderAmountState] = useState(DEFAULT_PLATFORM_CONFIG.minOrderAmount);
  // 顶层声明订单筛选状态，避免在嵌套函数内使用 Hook 引发顺序不稳定
  const [orderFilter, setOrderFilter] = useState('all');
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
  setRemoteUsers(Array.isArray(remote.users)? remote.users : []);
  setRemotePaymentMethods(Array.isArray(remote.paymentMethods)? remote.paymentMethods : []);
  setRemoteRates(Array.isArray(remote.rates)? remote.rates : []);
  setRemotePlatformDeposit(remote.platformDeposit || null);
  setLastRemoteSync(Date.now());
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
    if (showQueue) await refreshDiag();
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
      <Section title={t('grid_rate_settings')}>
        <TouchableOpacity onPress={()=> navigation.navigate('RateSettings')} style={{ paddingVertical:10, backgroundColor: colors.primary, borderRadius:8 }}>
          <Text style={{ color:'#fff', textAlign:'center', fontWeight:'600' }}>{t('grid_rate_settings')}</Text>
        </TouchableOpacity>
      </Section>
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
        <Text style={{ color:'#666' }}>Orders: {remoteOrders.length}</Text>
        <Text style={{ color:'#666', marginTop:4 }}>Deposits: {remoteDeposits.length}</Text>
        <Text style={{ color:'#666', marginTop:4 }}>Users: {remoteUsers.length}</Text>
        <Text style={{ color:'#666', marginTop:4 }}>PaymentMethods: {remotePaymentMethods.length}</Text>
        <Text style={{ color:'#666', marginTop:4 }}>Rates: {remoteRates.length}</Text>
        <Text style={{ color:'#666', marginTop:4 }}>PlatformDeposit: {remotePlatformDeposit ? '已配置' : '无'}</Text>
        <Text style={{ color:'#999', fontSize:12, marginTop:4 }}>Last Sync: {lastRemoteSync ? new Date(lastRemoteSync).toLocaleTimeString() : '-'}</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 }}>
          <TouchableOpacity onPress={async ()=>{ const r = await fetchRemoteLatest(); setRemoteOrders(r.orders||[]); setRemoteDeposits(r.deposits||[]); setRemoteUsers(r.users||[]); setRemotePaymentMethods(r.paymentMethods||[]); setRemoteRates(r.rates||[]); setRemotePlatformDeposit(r.platformDeposit||null); setLastRemoteSync(Date.now()); }} style={{ paddingVertical:6, paddingHorizontal:10, backgroundColor:'#1976D2', borderRadius:6 }}>
            <Text style={{ color:'#fff', fontSize:12 }}>刷新远端</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=> forceRetrySync()} style={{ paddingVertical:6, paddingHorizontal:10, backgroundColor:'#424242', borderRadius:6 }}>
            <Text style={{ color:'#fff', fontSize:12 }}>重试未送达</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async ()=>{ try { await mergeRemoteData({ users:remoteUsers, paymentMethods:remotePaymentMethods, rates:remoteRates, platformDeposit:remotePlatformDeposit }); Alert.alert(t('success'), '已合并远端数据'); } catch(e){ Alert.alert(t('error'), e.message||'合并失败'); } }} style={{ paddingVertical:6, paddingHorizontal:10, backgroundColor:'#2E7D32', borderRadius:6 }}>
            <Text style={{ color:'#fff', fontSize:12 }}>合并远端</Text>
          </TouchableOpacity>
        </View>
      </Section>
      {/* 系统状态 / 同步队列诊断折叠区块 */}
      <Section title={t('system_status') || '系统状态'}>
        <TouchableOpacity onPress={async ()=>{ const nv = !showQueue; setShowQueue(nv); if (nv) await refreshDiag(); }} style={{ paddingVertical:6, paddingHorizontal:10, backgroundColor: showQueue? '#1976D2':'#424242', borderRadius:6, alignSelf:'flex-start' }}>
          <Text style={{ color:'#fff', fontSize:12 }}>{t('sync_queue_title') || '同步队列'} {showQueue ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showQueue ? (
          <View style={{ marginTop:8 }}>
            {syncDiag.queue.length === 0 ? <Text style={{ color:'#999' }}>{t('queue_empty')}</Text> : (
              <View>
                {syncDiag.queue.map(item => {
                  const statusColor = item.status === 'sent' ? '#9E9E9E' : (item.status === 'scheduled' ? '#1976D2' : (item.retry>0 ? '#E53935' : '#0277BD'));
                  const nextAtStr = item.nextAttemptAt ? new Date(item.nextAttemptAt).toLocaleTimeString() : '-';
                  return (
                    <View key={item.id} style={{ paddingVertical:6, borderTopWidth:1, borderColor: colors.divider }}>
                      <Text style={{ fontWeight:'600', color: statusColor }}>{t('payload_summary')}: {item.summary}</Text>
                      <Text style={{ color:'#666', fontSize:11 }}>{t('retry_count')}: {item.retry} · {t('next_attempt_at')}: {nextAtStr}</Text>
                      <Text style={{ color:'#666', fontSize:11 }}>{t('status')}: {item.status === 'scheduled' ? (t('status_scheduled')||'已计划') : (item.retry>0 ? (t('status_failed')||'失败') : (t('status_waiting')||'待发送'))}</Text>
                      <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
                        <TouchableOpacity onPress={async ()=>{ await retryQueueItem(item.id); await refreshDiag(); }} style={{ paddingVertical:4, paddingHorizontal:8, backgroundColor:'#1976D2', borderRadius:4 }}>
                          <Text style={{ color:'#fff', fontSize:11 }}>{t('retry_now')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={async ()=>{ await discardQueueItem(item.id); await refreshDiag(); }} style={{ paddingVertical:4, paddingHorizontal:8, backgroundColor:'#E53935', borderRadius:4 }}>
                          <Text style={{ color:'#fff', fontSize:11 }}>{t('discard')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {/* 历史发送记录折叠 */}
            <TouchableOpacity onPress={()=> setShowHistory(v=>!v)} style={{ marginTop:10, paddingVertical:6, paddingHorizontal:10, backgroundColor:'#616161', borderRadius:6, alignSelf:'flex-start' }}>
              <Text style={{ color:'#fff', fontSize:12 }}>{showHistory ? (t('hide_history')||'收起历史') : (t('show_history')||'展开历史')}</Text>
            </TouchableOpacity>
            {showHistory ? (
              <View style={{ marginTop:6 }}>
                {syncDiag.history.length === 0 ? <Text style={{ color:'#999' }}>{t('queue_empty')}</Text> : syncDiag.history.slice().reverse().map(h => (
                  <View key={h.id+''+h.sentAt} style={{ paddingVertical:4, borderTopWidth:1, borderColor: colors.divider }}>
                    <Text style={{ color:'#9E9E9E', fontSize:11 }}>{h.summary}</Text>
                    <Text style={{ color:'#BDBDBD', fontSize:10 }}>{new Date(h.sentAt).toLocaleTimeString()}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Section>
      <Section title={`${t('users')}（${users.length}）`}>
        {/* 搜索与排序 */}
        <View style={{ marginBottom:8 }}>
          <TextInput
            value={userSearch}
            onChangeText={setUserSearch}
            placeholder={t('search_users_placeholder') || '搜索用户名/邀请码/上级码'}
            style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:10, height:40, backgroundColor:'#FAFAFA' }}
          />
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8, alignItems:'center' }}>
            <Text style={{ color:'#616161' }}>{t('sort_by') || '排序'}:</Text>
            {[
              { key:'registeredAt', label: t('registered_time') || '注册时间' },
              { key:'lastLoginAt', label: t('last_login_time') || '最近登录' },
              { key:'balanceUSDT', label: t('balance_usdt') || '余额USDT' },
              { key:'directChildren', label: t('direct_children_count') || '直推人数' },
            ].map(opt => (
              <TouchableOpacity key={opt.key} onPress={()=> setUserSortKey(opt.key)} style={{ paddingVertical:6, paddingHorizontal:10, borderRadius:16, borderWidth:1, borderColor: userSortKey===opt.key? colors.primary: colors.border, backgroundColor: userSortKey===opt.key? '#E3F2FD':'#fff' }}>
                <Text style={{ color: userSortKey===opt.key? colors.primary: '#424242', fontSize:12 }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={()=> setUserSortOrder(o => o==='asc'?'desc':'asc')} style={{ paddingVertical:6, paddingHorizontal:10, borderRadius:16, borderWidth:1, borderColor: colors.border }}>
              <Text style={{ fontSize:12 }}>{userSortOrder==='asc' ? (t('ascending') || '升序') : (t('descending') || '降序')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* 计算筛选后的列表 */}
        {(() => {
          const kw = (userSearch||'').trim().toLowerCase();
          let view = users.slice();
          if (kw) {
            view = view.filter(u => [u.username,u.inviteCode,u.inviterCode].some(v => (v||'').toLowerCase().includes(kw)));
          }
          const getVal = (u,key)=>{
            if (key==='registeredAt' || key==='lastLoginAt') return u[key] ? new Date(u[key]).getTime() : 0;
            if (key==='balanceUSDT' || key==='directChildren') return Number(u[key]||0);
            return 0;
          };
          view.sort((a,b)=>{
            const va = getVal(a, userSortKey);
            const vb = getVal(b, userSortKey);
            return userSortOrder==='asc' ? (va - vb) : (vb - va);
          });
          const filteredUsers = view;
          return (
            <>
              <TouchableOpacity onPress={async ()=>{
                try {
                  const { filename, csv } = await exportUsersCsv(t, filteredUsers);
                  const uri = FileSystem.documentDirectory + filename;
                  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
                  const actions = [];
                  try {
                    const Sharing = await import('expo-sharing');
                    if (Sharing?.isAvailableAsync && await Sharing.isAvailableAsync()) {
                      actions.push({ text: t('share') || t('open_settings') || '分享', onPress: async ()=>{ try { await Sharing.shareAsync(uri); } catch{} } });
                    }
                  } catch(e) {
                    // 动态导入失败时忽略分享按钮
                  }
                  actions.unshift({ text: t('copy')||'复制', onPress: async ()=>{ try { await Clipboard.setStringAsync(csv); } catch{} } });
                  actions.push({ text: t('confirm')||'确认' });
                  Alert.alert(t('success')||'成功', `${t('export_users_csv_done')||'CSV 已导出'}\n${uri}`, actions);
                } catch(e){
                  Alert.alert(t('error'), e?.message || '导出失败');
                }
              }} style={{ alignSelf:'flex-start', marginBottom:8, paddingHorizontal:12, paddingVertical:6, backgroundColor:'#424242', borderRadius:6 }}>
                <Text style={{ color:'#fff', fontSize:12 }}>{t('export_users_csv') || '导出 CSV'}</Text>
              </TouchableOpacity>
              {filteredUsers.length === 0 ? <Text style={{ color:'#999' }}>{t('empty_state')}</Text> : (
                <View>
                  {filteredUsers.map((u, idx) => (
                    <View key={idx} style={{ paddingVertical:8, borderTopWidth: idx===0?0:1, borderColor: colors.divider }}>
                      <Text style={{ fontWeight:'600' }}>{u.username} {u.isAdmin ? `· ${t('administrator')}` : ''}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>UID: {u.firebaseUid}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('invite_code_label')}: {u.inviteCode || '-'}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('inviter_code_label')}: {u.inviterCode || '-'}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('registered_time') || '注册时间'}: {u.registeredAt ? new Date(u.registeredAt).toLocaleString() : '-'}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('last_login_time') || '最近登录'}: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '-'}</Text>
                      <Text style={{ color:'#666', fontSize:12 }}>{t('direct_children_count') || '直推人数'}: {u.directChildren||0}</Text>
                      <View style={{ flexDirection:'row', marginTop:6, gap:12 }}>
                        <TouchableOpacity onPress={()=>{
                          Alert.alert(t('alert_title'), t('confirm_reset_password') || '确认重置该用户密码？重置后原密码失效', [
                            { text: t('cancel') || '取消', style:'cancel' },
                            { text: t('confirm') || '确认', onPress: async ()=>{
                              try{
                                const { resetPasswordForUser } = await import('../services/admin');
                                const res = await resetPasswordForUser(u.username);
                                setTempResetInfo(res);
                                Alert.alert(t('reset_password_success') || '已重置', `${t('temp_password_label') || '临时密码'}：${res.tempPassword}\n${t('must_change_password_note') || '用户登录后需强制修改'}`);
                                await load();
                              }catch(e){
                                Alert.alert(t('error'), e?.message || (t('reset_password_failed')||'重置失败'));
                              }
                            }}
                          ]);
                        }} style={{ paddingVertical:6, paddingHorizontal:10, backgroundColor:'#1976D2', borderRadius:6 }}>
                          <Text style={{ color:'#fff' }}>{t('reset_password_btn') || '重置密码'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          );
        })()}
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
          const base = orderFilter === 'all' ? orders.slice() : orders.filter(o => o.status === orderFilter).slice();
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
                  <TouchableOpacity
                    key={item.key}
                    onPress={()=> setOrderFilter(item.key)}
                    style={{
                      paddingVertical:6,
                      paddingHorizontal:10,
                      borderRadius:14,
                      borderWidth:1,
                      borderColor: orderFilter===item.key? colors.primary: colors.border,
                      backgroundColor: orderFilter===item.key? '#E3F2FD':'#fff',
                      alignSelf: 'flex-start',
                      marginBottom: 6,
                      // make tags responsive to long translations (e.g. Korean)
                      maxWidth: '48%',
                      flexShrink: 1,
                    }}
                  >
                    <Text numberOfLines={1} ellipsizeMode='tail' style={{ color: orderFilter===item.key? colors.primary: '#424242', fontSize:12 }}>{item.label}（{item.count}）</Text>
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