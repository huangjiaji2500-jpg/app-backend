import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userInfo: null,
  isAuthenticated: false,
  balance: {
    usdt: 0,
    totalEarnings: 0,
    withdrawableAmount: 0,
  },
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserInfo: (state, action) => {
      state.userInfo = action.payload;
      state.isAuthenticated = true;
    },
    updateBalance: (state, action) => {
      state.balance = { ...state.balance, ...action.payload };
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.userInfo = null;
      state.isAuthenticated = false;
      state.balance = initialState.balance;
    },
  },
});

export const { setUserInfo, updateBalance, setLoading, setError, logout } = userSlice.actions;
export default userSlice.reducer;