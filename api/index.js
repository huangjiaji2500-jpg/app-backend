const serverless = require('serverless-http');
// 导入 Express app（backend/server.js 在被 require 时会直接返回 app）
const app = require('../backend/server');

module.exports = serverless(app);
