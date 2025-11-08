import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  orders: [],
  currentFilter: 'all', // all, pending_payment, pending_confirm, dispute, completed
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    hasMore: true,
  },
};

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action) => {
      state.orders = action.payload;
    },
    addOrders: (state, action) => {
      state.orders = [...state.orders, ...action.payload];
    },
    updateOrder: (state, action) => {
      const { orderId, updates } = action.payload;
      const orderIndex = state.orders.findIndex(order => order.id === orderId);
      if (orderIndex !== -1) {
        state.orders[orderIndex] = { ...state.orders[orderIndex], ...updates };
      }
    },
    setCurrentFilter: (state, action) => {
      state.currentFilter = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    resetOrders: (state) => {
      state.orders = [];
      state.pagination = initialState.pagination;
    },
  },
});

export const { 
  setOrders, 
  addOrders, 
  updateOrder, 
  setCurrentFilter, 
  setLoading, 
  setError, 
  setPagination, 
  resetOrders 
} = orderSlice.actions;
export default orderSlice.reducer;