const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const ADMIN_SECRET = process.env.ADMIN_PANEL_SECRET || 'sY9vK8rG-3qZ2eLw7pN4tA1bX8uH0cY6';

// in-memory user store keyed by id or username
const usersById = {};
const usersByUsername = {};

function generateTemp() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let temp = '';
  for (let i=0;i<8;i++) temp += chars[Math.floor(Math.random()*chars.length)];
  return temp;
}

function hashTemp(temp) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(temp, salt, 64).toString('hex');
  return `${salt}$${derived}`;
}

function verifyTemp(stored, candidate) {
  if (!stored || stored.indexOf('$')===-1) return false;
  const [salt, derived] = stored.split('$');
  const cand = crypto.scryptSync(candidate, salt, 64).toString('hex');
  return cand === derived;
}

// simple seed user
const seedId = 'local_seed_jiaji250';
const seedUsername = 'jiaji250';
usersById[seedId] = { id: seedId, username: seedUsername };
usersByUsername[seedUsername] = usersById[seedId];

app.patch('/api/admin/users', (req, res) => {
  const header = req.headers['x-admin-secret'] || '';
  if (header !== ADMIN_SECRET) return res.status(401).json({ ok:false, error:'Unauthorized' });
  const body = req.body || {};
  const targetId = body.id;
  if (!targetId) return res.status(400).json({ ok:false, error:'id required' });
  const u = usersById[targetId];
  if (!u) return res.status(404).json({ ok:false, error:'user not found' });
  if (body.resetPassword !== true) return res.status(400).json({ ok:false, error:'resetPassword required' });
  const temp = generateTemp();
  const stored = hashTemp(temp);
  u.tempPasswordHash = stored;
  u.mustChangePassword = true;
  // respond with plaintext temp in resp.update.tempPassword to mirror real API
  return res.json({ ok:true, id: targetId, update: { mustChangePassword: true, tempPassword: temp } });
});

app.post('/api/auth/login-temp', (req, res) => {
  const body = req.body || {};
  const username = body.username;
  const password = body.password;
  if (!username || !password) return res.status(400).json({ ok:false, error:'username & password required' });
  const u = usersByUsername[username];
  if (!u) return res.status(404).json({ ok:false, error:'user not found' });
  const stored = u.tempPasswordHash;
  if (!stored) return res.status(401).json({ ok:false, error:'no temp password set' });
  if (!verifyTemp(stored, password)) return res.status(401).json({ ok:false, error:'invalid temp password' });
  // success: clear tempPasswordHash and set lastUsed
  delete u.tempPasswordHash;
  u.tempPasswordLastUsedAt = new Date().toISOString();
  u.lastLoginAt = new Date().toISOString();
  // return mock token and mustChangePassword flag
  return res.json({ ok:true, token: 'mock-jwt-token-for-'+username, mustChangePassword: !!u.mustChangePassword });
});

app.get('/health', (req,res)=> res.json({ status:'OK', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log('Mock auth server listening on port', PORT));
