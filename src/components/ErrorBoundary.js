import React from 'react';
import { View, Text } from 'react-native';
import { I18nContext } from '../context/I18nContext';

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error){
    return { hasError: true, error };
  }
  componentDidCatch(error, info){
    // eslint-disable-next-line no-console
    console.error('[BOUNDARY]', error, info);
  }
  render(){
    const t = (this.context && this.context.t) ? this.context.t : (k=>k);
    if (this.state.hasError){
      return (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24 }}>
          <Text style={{ fontSize:16, fontWeight:'700', marginBottom:8 }}>{t('page_unavailable') || '页面暂时不可用'}</Text>
          <Text style={{ color:'#666', textAlign:'center' }}>{t('returning_to_home') || '请返回重试或稍后再试'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.contextType = I18nContext;
