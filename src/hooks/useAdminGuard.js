import React from 'react';
import { Alert } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { isCurrentUserAdmin } from '../services/auth';

// 统一的后台访问保护：非管理员立即回退到首页并给出不暴露后台的中性提示
export function useAdminGuard(navigation) {
  const { t } = useI18n();
  const [allowed, setAllowed] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isCurrentUserAdmin();
      if (!mounted) return;
      if (!ok) {
        try { Alert.alert(t('page_unavailable'), t('returning_to_home')); } catch {}
        // 回到主Tab首页（交易大厅）
        navigation?.navigate?.('MainTabs', { screen: '交易大厅' });
        setAllowed(false);
      } else {
        setAllowed(true);
      }
    })();
    return () => { mounted = false; };
  }, [navigation, t]);

  return allowed;
}

export default useAdminGuard;
