import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import tradingReducer from './tradingSlice';
import orderReducer from './orderSlice';
import teamReducer from './teamSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    trading: tradingReducer,
    orders: orderReducer,
    team: teamReducer,
  },
});

// Type definitions for TypeScript (if needed)