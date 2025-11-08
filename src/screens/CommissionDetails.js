import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { getCurrentUsername } from '../services/auth';
import { getCommissions } from '../services/team';

const PAGE_SIZE = 10;

export default function CommissionDetails({ navigation }) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useI18n();
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState('');

  const loadPage = useCallback(async (reset = false) => {
    const u = username || (await getCurrentUsername());
    if (!u) return;
    const all = await getCommissions();
    const mine = all.filter(c => c.toUsername === u);
    const start = reset ? 0 : (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const slice = mine.slice(start, end);
    if (reset) {
      setData(slice);
      setHasMore(end < mine.length);
      setPage(2);
    } else {
      setData(prev => prev.concat(slice));
      setHasMore(end < mine.length);
      setPage(prev => prev + 1);
    }
  }, [page, username]);

  const onRefresh = async () => {
    setRefreshing(true);
    const u = await getCurrentUsername();
    setUsername(u || '');
    await loadPage(true);
    setRefreshing(false);
  };

  useEffect(() => {
    navigation.setOptions({ title: t('commission_details') });
  }, [t]);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUsername();
      setUsername(u || '');
      await loadPage(true);
    })();
  }, []);

  const renderItem = ({ item }) => {
    const levelLabel = item.level === 1 ? t('level1_commission') : item.level === 2 ? t('level2_commission') : t('level3_commission');
    return (
      <View style={{ backgroundColor:'#fff', marginHorizontal: spacing.md, marginTop: 10, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider, padding:12 }}>
        <Text style={{ fontWeight:'700', color: '#1565C0' }}>{t('commission_amount')}: {item.amountUSDT} USDT</Text>
        <Text style={{ marginTop:6 }}>{t('from_user')}: {item.fromUsername} · {t('commission_level')}: {levelLabel}</Text>
        <Text style={{ marginTop:6, color:'#757575' }}>{t('created_time')}: {new Date(item.createdAt).toLocaleString()}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex:1, backgroundColor: colors.background }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={() => { if (hasMore) loadPage(false); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={() => hasMore ? <View style={{ height: 60 }} /> : <View style={{ height: 20 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} title={t('refreshing')} />}
      />
    </View>
  );
}
