import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  teamStats: {
    totalMembers: 0,
    level1Members: 0,
    level2Members: 0,
    level3Members: 0,
    totalCommission: 0,
    level1Commission: 0,
    level2Commission: 0,
    level3Commission: 0,
  },
  teamMembers: [],
  commissionHistory: [],
  inviteCode: '',
  loading: false,
  error: null,
};

const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {
    setTeamStats: (state, action) => {
      state.teamStats = action.payload;
    },
    setTeamMembers: (state, action) => {
      state.teamMembers = action.payload;
    },
    addTeamMember: (state, action) => {
      state.teamMembers.push(action.payload);
      // 更新统计数据
      const level = action.payload.level;
      state.teamStats.totalMembers += 1;
      if (level === 1) state.teamStats.level1Members += 1;
      else if (level === 2) state.teamStats.level2Members += 1;
      else if (level === 3) state.teamStats.level3Members += 1;
    },
    setCommissionHistory: (state, action) => {
      state.commissionHistory = action.payload;
    },
    addCommissionRecord: (state, action) => {
      state.commissionHistory.unshift(action.payload);
      // 更新总佣金
      state.teamStats.totalCommission += action.payload.amount;
      const level = action.payload.level;
      if (level === 1) state.teamStats.level1Commission += action.payload.amount;
      else if (level === 2) state.teamStats.level2Commission += action.payload.amount;
      else if (level === 3) state.teamStats.level3Commission += action.payload.amount;
    },
    setInviteCode: (state, action) => {
      state.inviteCode = action.payload;
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
  setTeamStats, 
  setTeamMembers, 
  addTeamMember, 
  setCommissionHistory, 
  addCommissionRecord, 
  setInviteCode, 
  setLoading, 
  setError 
} = teamSlice.actions;
export default teamSlice.reducer;