const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tradingRoutes = require('./routes/trading');
const orderRoutes = require('./routes/orders');
const teamRoutes = require('./routes/team');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// MongoDB connect with in-memory fallback
async function connectMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/usdt_trading';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected successfully to', uri);
    return;
  } catch (err) {
    console.error('MongoDB connection error:', err && err.message);
    if (process.env.DISABLE_INMEM_MONGO === '1') {
      console.error('DISABLE_INMEM_MONGO set, will not start in-memory Mongo.');
      throw err;
    }
    try {
      console.log('Attempting to start in-memory MongoDB for local testing...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('Connected to in-memory MongoDB:', memUri);
      process.__MONGOD__ = mongod;
      return;
    } catch (memErr) {
      console.error('Failed to start in-memory MongoDB:', memErr && memErr.message);
      throw memErr;
    }
  }
}

connectMongo().catch(e => console.error('MongoDB setup failed (continuing):', e && e.message));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use((err, req, res, next) => {
  console.error(err && err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

server.listen(PORT, () => {
  console.log(`Admin-capable server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

io.on('connection', socket => {
  console.log('Socket connected:', socket.id);
  socket.emit('ticker', { type: 'welcome', message: '欢迎接入实时动态' });
});

setInterval(() => {
  const samples = [
    `用户****成功提现${Math.floor(Math.random()*200+10)} USDT`,
    `用户****团队返佣${Math.floor(Math.random()*50+5)} USDT`,
    `用户****订单完成 获得收益${Math.floor(Math.random()*100+20)} USDT`
  ];
  const msg = samples[Math.floor(Math.random()*samples.length)];
  io.emit('ticker', { type: 'event', message: msg, ts: Date.now() });
}, 10000);
