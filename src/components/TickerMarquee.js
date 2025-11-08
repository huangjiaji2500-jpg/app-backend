import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import io from 'socket.io-client';
import { subscribe } from '../services/ticker';
import { useI18n } from '../context/I18nContext';

const { width } = Dimensions.get('window');

export default function TickerMarquee() {
  const { t } = useI18n();
  const [messages, setMessages] = useState([
    t('ticker_withdraw_success', { amount: 100 }) || '用户****成功提现100 USDT',
    t('ticker_team_commission', { amount: 25 }) || '用户****团队返佣25 USDT',
    t('ticker_order_profit', { amount: 80 }) || '用户****订单完成 获得收益80 USDT',
  ]);
  const scrollRef = useRef(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    // 连接本地socket（后端已内置模拟），若不可用不影响展示
    let socket;
    const off = subscribe((msg)=> setMessages((prev)=> [msg, ...prev].slice(0, 20)));
    try {
      socket = io('http://localhost:3000', { transports: ['websocket'], reconnection: true });
      socket.on('ticker', (data) => {
        if (data?.message) {
          setMessages((prev) => [data.message, ...prev].slice(0, 20));
        }
      });
    } catch {}
    return () => { try { socket && socket.disconnect(); } catch {}; off && off(); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      offsetRef.current += 2;
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: offsetRef.current, animated: false });
        if (offsetRef.current > width) offsetRef.current = 0; // loop
      }
    }, 30);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.wrap}>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}>
        <Text style={styles.text}>{messages.join('    ·    ')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  text: {
    color: '#1565C0',
    fontWeight: '600',
  },
});