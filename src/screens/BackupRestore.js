import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = [
  'LOCAL_AUTH_USERS',
  'LOCAL_ORDERS',
  'DEPOSIT_REQUESTS',
  'PLATFORM_CONFIG',
  'PLATFORM_DEPOSIT_CONFIG',
  'selectedLanguage',
];

async function exportAll(){
  const out = {};
  for (const k of KEYS){
    try { out[k] = await AsyncStorage.getItem(k); } catch { out[k] = null; }
  }
  return JSON.stringify(out);
}

async function importAll(json){
  const obj = JSON.parse(json);
  for (const k of KEYS){
    if (Object.prototype.hasOwnProperty.call(obj, k)){
      const v = obj[k];
      if (v === null || v === undefined) continue;
      await AsyncStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }
}

export default function BackupRestore(){
  const { colors, borderRadius, spacing } = useTheme();
  const { t } = useI18n();
  const [backup, setBackup] = useState('');
  useEffect(()=>{ (async ()=>{ setBackup(await exportAll()); })(); },[]);

  return (
    <View style={{ flex:1, padding: spacing.md, backgroundColor: colors.background }}>
      <View style={{ backgroundColor:'#fff', padding:12, borderRadius: borderRadius.lg, borderWidth:1, borderColor: colors.divider }}>
        <Text style={{ fontWeight:'700', fontSize:16 }}>{t('backup_restore') || '数据备份/恢复'}</Text>
        <Text style={{ color:'#757575', marginTop:6 }}>{t('backup_tip') || '把下面这段文字复制保存；恢复时粘贴回来并点击恢复即可。'}</Text>
        <TextInput multiline value={backup} onChangeText={setBackup} style={{ marginTop:8, minHeight:120, borderWidth:1, borderColor: colors.border, borderRadius:8, padding:8, textAlignVertical:'top' }} />
        <View style={{ flexDirection:'row', gap:12, marginTop:12 }}>
          <TouchableOpacity onPress={async ()=>{ try { await Clipboard.setStringAsync(backup); Alert.alert(t('success'), t('copied')); } catch{} }} style={{ backgroundColor: colors.primary, paddingVertical:10, paddingHorizontal:12, borderRadius:8 }}>
            <Text style={{ color:'#fff' }}>{t('copy_backup') || '复制备份'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async ()=>{ try { setBackup(await exportAll()); } catch{} }} style={{ backgroundColor: '#1976D2', paddingVertical:10, paddingHorizontal:12, borderRadius:8 }}>
            <Text style={{ color:'#fff' }}>{t('export_backup') || '重新导出'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async ()=>{ try { await importAll(backup); Alert.alert(t('success'), t('restore_done') || '恢复完成'); } catch(e){ Alert.alert(t('error'), e?.message || '恢复失败'); } }} style={{ backgroundColor: '#2E7D32', paddingVertical:10, paddingHorizontal:12, borderRadius:8 }}>
            <Text style={{ color:'#fff' }}>{t('restore_now') || '立即恢复'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
