const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// mock User model before loading routes
jest.mock('../models/User');
const User = require('../models/User');

// load the router after mocking
const authRoutes = require('../routes/auth');

const { generateTempAndHash } = require('../lib/temp-password');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

describe('reset -> login-temp 集成测试（通过 mock User）', () => {
  test('管理员生成临时密码后，用户使用临时密码能登录', async () => {
    // 1) 模拟管理员生成临时密码并保存到用户文档的 tempPasswordHash
    const { temp, stored } = generateTempAndHash();

    const fakeUser = {
      _id: '507f1f77bcf86cd799439011',
      username: 'testuser',
      inviteCode: 'INV123',
      tempPasswordHash: stored,
      mustChangePassword: true,
      devices: [],
      save: jest.fn().mockResolvedValue(true),
    };

    // User.findOne should resolve to our fakeUser
    User.findOne = jest.fn().mockResolvedValue(fakeUser);

    const app = makeApp();

    // 2) 错误密码应被拒绝（未消耗 temp 前）
    await request(app).post('/api/auth/login-temp').send({ username: 'testuser', password: temp + 'x' }).expect(401);

    // 3) 正确的临时密码能登录
    const resp = await request(app)
      .post('/api/auth/login-temp')
      .send({ username: 'testuser', password: temp })
      .expect(200);

    expect(resp.body).toHaveProperty('token');
    expect(resp.body.user).toBeDefined();
    expect(resp.body.user.username).toBe('testuser');

    // mustChangePassword flag should be returned
    expect(resp.body.mustChangePassword).toBe(true);

    // after successful login the tempPasswordHash should be removed and lastUsed set
    expect(fakeUser.tempPasswordHash).toBeUndefined();
    expect(fakeUser.tempPasswordLastUsedAt).toBeDefined();

    // 验证 token 可解析（使用 default JWT_SECRET）
    const token = resp.body.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    expect(decoded).toHaveProperty('id');
  });
});
