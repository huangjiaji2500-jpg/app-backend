import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { ThemeProvider } from './src/context/ThemeContext';
import { I18nProvider } from './src/context/I18nContext';
import { useI18n } from './src/context/I18nContext';
import { View, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import Constants from 'expo-constants';
import { loadAuthToken } from './src/services/auth';
import ErrorBoundary from './src/components/ErrorBoundary';
// expo-updates 在 Expo Go 下不可用；使用动态导入以避免开发期崩溃

// 导入页面组件
import TradingHall from './src/screens/TradingHall';
import MyOrders from './src/screens/MyOrders';
import PersonalCenter from './src/screens/PersonalCenter';
import FAQ from './src/screens/FAQ';
import EarningsDetails from './src/screens/EarningsDetails';
import PaymentAddress from './src/screens/PaymentAddress';
import Team from './src/screens/Team';
import Login from './src/screens/Login';
import Register from './src/screens/Register';
import OrderDetail from './src/screens/OrderDetail';
import OrderCreate from './src/screens/OrderCreate';
import RateSettings from './src/screens/RateSettings';
import Messages from './src/screens/Messages';
import IncomeRecords from './src/screens/IncomeRecords';
import TransferRecords from './src/screens/TransferRecords';
import ContactUs from './src/screens/ContactUs';
import AboutUs from './src/screens/AboutUs';
import InviteRewards from './src/screens/InviteRewards';
import CommissionDetails from './src/screens/CommissionDetails';
import AdminDashboard from './src/screens/AdminDashboard';
// AdminUnlock 暂不对普通用户暴露
import AdminUnlock from './src/screens/AdminUnlock';
import LanguageSettings from './src/screens/LanguageSettings';
import PaymentMethodAdd from './src/screens/PaymentMethodAdd';
import PaymentMethodManager from './src/screens/PaymentMethodManager';
import PaymentMethodEdit from './src/screens/PaymentMethodEdit';
import Recharge from './src/screens/Recharge';
import AdminDepositsReview from './src/screens/AdminDepositsReview';
import AdminOrderDetail from './src/screens/AdminOrderDetail';
import ForcePasswordChange from './src/screens/ForcePasswordChange';

// 导入图标
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === '交易大厅') {
            iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
          } else if (route.name === '我的订单') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === '资讯中心') {
            iconName = focused ? 'help-circle' : 'help-circle-outline';
          } else if (route.name === '个人中心') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="交易大厅" component={TradingHall} options={{ tabBarLabel: t('trading_hall') }} />
      <Tab.Screen name="我的订单" component={MyOrders} options={{ tabBarLabel: t('my_orders') }} />
      <Tab.Screen name="资讯中心" component={FAQ} options={{ tabBarLabel: t('news_center') }} />
      <Tab.Screen name="个人中心" component={PersonalCenter} options={{ tabBarLabel: t('personal_center') }} />
    </Tab.Navigator>
  );
}

function UpdateBanner({ status, onReload, errorMessage }) {
  // 临时紧急修复：立即隐藏所有更新提示（由发布渠道或原生重构后再恢复）
  // 如果你需要恢复展示，请移除下面这行或改为更细粒度的判断。
  return null;
  const styleBase = { position:'absolute', top:0, left:0, right:0, padding:10, zIndex:999, alignItems:'center' };
  if (status === 'checking') return <View style={{ ...styleBase, backgroundColor:'#1976D2' }}><View><ActivityIndicator color='#fff' /></View></View>;
  if (status === 'downloading') return <View style={{ ...styleBase, backgroundColor:'#0288D1' }}><Text style={{ color:'#fff' }}>下载更新中…</Text></View>;
  if (status === 'downloaded') return <View style={{ ...styleBase, backgroundColor:'#2E7D32' }}><TouchableOpacity onPress={onReload}><Text style={{ color:'#fff', fontWeight:'600' }}>新版本已就绪，点击重启</Text></TouchableOpacity></View>;
  if (status === 'error') return (
    <View style={{ ...styleBase, backgroundColor:'#E53935' }}>
      <Text style={{ color:'#fff', fontWeight:'600' }}>更新失败，稍后重试</Text>
      {errorMessage ? (
        <Text style={{ color:'#fff', marginTop:6, fontSize:12, lineHeight:16 }}>{errorMessage}</Text>
      ) : null}
    </View>
  );
  return null;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null); // null|checking|downloading|downloaded|error
  const [lastUpdateFailAt, setLastUpdateFailAt] = useState(null);
  const [updateError, setUpdateError] = useState(null);

  useEffect(() => {
    const init = async () => {
      await loadAuthToken();
      const token = global.__AUTH_TOKEN__;
      setHasToken(!!token);
      setBooting(false);
      // 热更新检测（节流：失败后 10 分钟内不再重复）
      const now = Date.now();
      if (lastUpdateFailAt && (now - lastUpdateFailAt) < 10*60*1000) return;
      // 如果在 Expo Go/guest 环境中，不运行热更新逻辑以避免开发期误报
      try {
        if (Constants && (Constants.appOwnership === 'expo' || Constants.appOwnership === 'guest')) {
          setUpdateStatus(null);
          return;
        }
      } catch (e) {
        // ignore and continue to attempt dynamic import in unknown environments
      }
      try {
        // 动态导入避免在 Expo Go 环境崩溃
        const Updates = await import('expo-updates');
        setUpdateStatus('checking');
        setUpdateError(null);
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          setUpdateStatus('downloading');
          await Updates.fetchUpdateAsync();
          setUpdateStatus('downloaded');
        } else {
          setUpdateStatus(null); // 没有新版本
        }
      } catch (e){
        const msg = e && (e.message || String(e));
        // Suppress the known development-build rejection from expo-updates
        // (e.g., "Updates.checkForUpdateAsync() is not supported in development builds.")
        if (msg && msg.toLowerCase().includes('not supported in development builds')) {
          // treat as no-op in development builds: don't show error banner and avoid noisy error logs
          console.debug('expo-updates check skipped in development build:', msg);
          setUpdateStatus(null);
          setUpdateError(null);
          setLastUpdateFailAt(Date.now());
          return;
        }
        // For production/runtime errors, avoid showing a blocking red overlay to users.
        // Log the error for diagnostics but keep the UI usable. Store error text for optional
        // debugging but do not set status='error' which triggers the red full-width banner.
        console.warn('expo-updates check failed (non-fatal):', e);
        setUpdateStatus(null); // keep app usable, no blocking banner
        setUpdateError(msg + (e.stack ? '\n' + e.stack : ''));
        setLastUpdateFailAt(Date.now());
      }
    };
    init();
  }, [lastUpdateFailAt]);

  const handleReload = useCallback(async ()=>{
    try {
      const Updates = await import('expo-updates');
      await Updates.reloadAsync();
    } catch {}
  }, []);

  return (
    <Provider store={store}>
      <I18nProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <NavigationContainer>
              <UpdateBanner status={updateStatus} onReload={handleReload} errorMessage={updateError} />
            {booting ? (
              <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                <ActivityIndicator size="large" color="#2196F3" />
              </View>
            ) : (
              <RootStack hasToken={hasToken} />
            )}
            </NavigationContainer>
          </ErrorBoundary>
        </ThemeProvider>
      </I18nProvider>
    </Provider>
  );
}

function RootStack({ hasToken }) {
  const { t } = useI18n();
  return (
    <Stack.Navigator initialRouteName={hasToken ? 'MainTabs' : 'Login'}>
      <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={Register} options={{ title: t('register') || '注册' }} />
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="EarningsDetails" component={EarningsDetails} options={{ title: t('grid_earnings_details') }} />
      <Stack.Screen name="PaymentAddress" component={PaymentAddress} options={{ title: t('payment_address') || '收款地址' }} />
      <Stack.Screen name="Team" component={Team} options={{ title: t('grid_my_team') }} />
      <Stack.Screen name="RateSettings" component={RateSettings} options={{ title: t('grid_rate_settings') }} />
      <Stack.Screen name="Messages" component={Messages} options={{ title: t('grid_my_messages') }} />
      <Stack.Screen name="IncomeRecords" component={IncomeRecords} options={{ title: t('grid_income_records') }} />
      <Stack.Screen name="TransferRecords" component={TransferRecords} options={{ title: t('grid_transfer_records') }} />
      <Stack.Screen name="ContactUs" component={ContactUs} options={{ title: t('grid_contact_us') }} />
      <Stack.Screen name="AboutUs" component={AboutUs} options={{ title: t('grid_about_us') }} />
      <Stack.Screen name="InviteRewards" component={InviteRewards} options={{ title: t('grid_invite_rewards') }} />
      <Stack.Screen name="CommissionDetails" component={CommissionDetails} options={{ title: t('commission_details') || '返佣明细' }} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ title: t('admin_dashboard') || '管理面板' }} />
      <Stack.Screen name="AdminDepositsReview" component={AdminDepositsReview} options={{ title: t('deposits_review') || '充值审核' }} />
      <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetail} options={{ title: t('order_detail') || '订单详情' }} />
      {/* 管理员解锁页不在正常导航中暴露，保留代码但默认不注册；如需手动启用可将其放入条件 */}
      <Stack.Screen name="LanguageSettings" component={LanguageSettings} options={{ title: t('grid_language_settings') }} />
  <Stack.Screen name="PaymentMethodAdd" component={PaymentMethodAdd} options={{ title: t('add_payment_method') || '添加收款方式' }} />
    <Stack.Screen name="PaymentMethodManager" component={PaymentMethodManager} options={{ title: t('manage_payment_methods') || '支付方式管理' }} />
    <Stack.Screen name="PaymentMethodEdit" component={PaymentMethodEdit} options={{ title: t('add_payment_method') || '添加支付方式' }} />
    <Stack.Screen name="Recharge" component={Recharge} options={{ title: t('recharge') || '充值' }} />
    {/* Admin routes injected conditionally above */}
      <Stack.Screen name="OrderDetail" component={OrderDetail} options={{ title: t('order_detail') || '订单详情' }} />
      <Stack.Screen name="OrderCreate" component={OrderCreate} options={{ title: t('order_create') || '创建订单' }} />
      <Stack.Screen name="ForcePasswordChange" component={ForcePasswordChange} options={{ title: t('force_change_password_title') || '修改临时密码' }} />
    </Stack.Navigator>
  );
}