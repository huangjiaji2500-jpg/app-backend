import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EmptyState({ text = '空空如也~' }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#9E9E9E',
  },
});