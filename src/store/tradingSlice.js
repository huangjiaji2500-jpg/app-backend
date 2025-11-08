import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  merchants: [],
  currentTab: 'sell', // 'sell' 或 'quick'
  tradeHistory: [],
  loading: false,
  error: null,
  filters: {
    minAmount: '',
    maxAmount: '',
    paymentMethod: '',
  },
};

const tradingSlice = createSlice({
  name: 'trading',
  initialState,
  reducers: {
    setMerchants: (state, action) => {
      state.merchants = action.payload;
    },
    setCurrentTab: (state, action) => {
      state.currentTab = action.payload;
    },
    addTradeHistory: (state, action) => {
      state.tradeHistory.unshift(action.payload);
      // 保持最多20条记录
      if (state.tradeHistory.length > 20) {
        state.tradeHistory = state.tradeHistory.slice(0, 20);
      }
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { 
  setMerchants, 
  setCurrentTab, 
  addTradeHistory, 
  setFilters, 
  setLoading, 
  setError 
} = tradingSlice.actions;
export default tradingSlice.reducer;