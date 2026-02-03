// Removing duplicate endpoint for '/games'
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');

const APP_SECRET = process.env.APP_SECRET || 'dev_secret_change_me';
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const livePlayers = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'uploads');
const upload = multer({ dest: uploadsDir });

// Postgres helpers
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in your environment (Render + Neon).');
  process.exit(1);
}

const useSSL = /sslmode=require/i.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

const runAsync = (sql, params = []) => pool.query(sql, params);
const getAsync = async (sql, params = []) => {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
};
const allAsync = async (sql, params = []) => {
  const res = await pool.query(sql, params);
  return res.rows || [];
};

// Initialize DB
async function initDB() {
  try {
    await runAsync(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      balance INTEGER DEFAULT 0,
      creabux INTEGER DEFAULT 1000,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await runAsync(`CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      owner INTEGER,
      filename TEXT,
      type TEXT,
      metadata TEXT
    )`);
    await runAsync(`CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      owner INTEGER,
      title TEXT,
      description TEXT,
      metadata TEXT,
      plays INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      published BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await runAsync(`CREATE TABLE IF NOT EXISTS avatars (
      id SERIAL PRIMARY KEY,
      owner INTEGER,
      name TEXT,
      data TEXT,
      is_default BOOLEAN DEFAULT FALSE
    )`);
    await runAsync(`CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter INTEGER,
      content_type TEXT,
      content_id INTEGER,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await runAsync(`CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      amount INTEGER,
      type TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    let admin = await getAsync(`SELECT id FROM users WHERE username = 'admin'`);
    if (!admin) {
      const hash = bcrypt.hashSync('adminpass', 10);
      const res = await runAsync(
        `INSERT INTO users (username, password, balance, creabux, is_admin)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id`,
        ['admin', hash, 0, 999999999]
      );
      admin = { id: res.rows[0].id };
      console.log('✓ Admin user seeded');
    }

    const assetCount = await getAsync(`SELECT COUNT(*) as c FROM assets`);
    const assetTotal = parseInt(assetCount?.c || '0', 10);
    if (assetTotal === 0) {
      const slots = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
      const parts = {};
      for (const g of ['male', 'female']) {
        parts[g] = {};
        for (const s of slots) {
          const res = await runAsync(
            `INSERT INTO assets (owner, filename, type, metadata)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [admin.id, `r6_${s}_${g}`, 'bodypart', JSON.stringify({ slot: s, gender: g, name: `R6 ${s} ${g}` })]
          );
          parts[g][s] = res.rows[0].id;
        }
      }

      await runAsync(
        `INSERT INTO avatars (owner, name, data, is_default) VALUES ($1, $2, $3, TRUE)`,
        [admin.id, 'R6_Male', JSON.stringify({ type: 'r6', gender: 'male', parts: parts.male,
          colors: { head: '#ffdbac', torso: '#0066cc', leftArm: '#ffdbac', rightArm: '#ffdbac', leftLeg: '#0066cc', rightLeg: '#0066cc' }
        })]
      );
      await runAsync(
        `INSERT INTO avatars (owner, name, data, is_default) VALUES ($1, $2, $3, TRUE)`,
        [admin.id, 'R6_Female', JSON.stringify({ type: 'r6', gender: 'female', parts: parts.female,
          colors: { head: '#ffdbac', torso: '#ff66cc', leftArm: '#ffdbac', rightArm: '#ffdbac', leftLeg: '#ff66cc', rightLeg: '#ff66cc' }
        })]
      );
      
      // Seed first game "Creatix"
      const gameRes = await runAsync(
        `INSERT INTO games (owner, title, description, metadata) VALUES ($1, $2, $3, $4)`,
        [admin.id, 'Creatix', 'The official Creatix game creation platform showcase!', JSON.stringify({ genre: 'simulation', maxPlayers: 100 })]
      );
      console.log('✓ Default assets, avatars and Creatix game seeded');
    }

    // Ensure Creatix is published so it appears in listings
    await runAsync(`UPDATE games SET published = TRUE WHERE title = 'Creatix' AND published = FALSE`);
  } catch (e) {
    console.error('DB init error:', e);
    throw e;
  }
}

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, APP_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing auth' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid auth' });
  try {
    req.user = jwt.verify(parts[1], APP_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const hash = await bcrypt.hash(password, 10);
    const result = await runAsync(
      `INSERT INTO users (username, password, balance, creabux, is_admin)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id`,
      [username, hash, 0, 1000]
    );
    const user = { id: result.rows[0].id, username };
    res.json({ token: generateToken(user), user });
  } catch (err) {
    res.status(400).json({ error: 'User exists' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const row = await getAsync(`SELECT * FROM users WHERE username = $1`, [username]);
    if (!row) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const user = { id: row.id, username: row.username };
    res.json({ token: generateToken(user), user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/me', authMiddleware, async (req, res) => {
  try {
    const row = await getAsync(`SELECT id, username, balance, creabux, is_admin FROM users WHERE id = $1`, [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ id: row.id, username: row.username, balance: row.balance, creabux: row.creabux, is_admin: !!row.is_admin });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Avatars endpoints
app.get('/avatars', async (req, res) => {
  try {
    const rows = await allAsync(`SELECT id, owner, name, data, is_default FROM avatars`);
    res.json({ avatars: rows.map(r => ({
      id: r.id, owner: r.owner, name: r.name,
      data: JSON.parse(r.data || '{}'), is_default: !!r.is_default
    })) });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/avatar-parts', async (req, res) => {
  try {
    const rows = await allAsync(`SELECT id, owner, filename, metadata FROM assets WHERE type = 'bodypart'`);
    const parts = rows.map(r => {
      let md = {};
      try { md = JSON.parse(r.metadata || '{}'); } catch (e) {}
      return { id: r.id, owner: r.owner, filename: r.filename, slot: md.slot, gender: md.gender, name: md.name };
    });
    res.json({ parts });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/avatars/:id/select-part', authMiddleware, async (req, res) => {
  try {
    const { slot, asset_id } = req.body;
    if (!slot || !asset_id) return res.status(400).json({ error: 'Missing slot or asset_id' });
    const row = await getAsync(`SELECT owner, data FROM avatars WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Avatar not found' });
    if (row.owner !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const asset = await getAsync(`SELECT id, type, metadata FROM assets WHERE id = $1`, [asset_id]);
    if (!asset) return res.status(400).json({ error: 'Asset not found' });
    if (asset.type !== 'bodypart') return res.status(400).json({ error: 'Asset is not a bodypart' });
    let md = {};
    try { md = JSON.parse(asset.metadata || '{}'); } catch (ex) {}
    if (md.slot !== slot) return res.status(400).json({ error: 'Slot mismatch' });
    let data = {};
    try { data = JSON.parse(row.data || '{}'); } catch (ex) { data = {}; }
    if (!data.parts) data.parts = {};
    data.parts[slot] = asset.id;
    await runAsync(`UPDATE avatars SET data = $1 WHERE id = $2`, [JSON.stringify(data), req.params.id]);
    res.json({ ok: true, avatar: { id: req.params.id, data } });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/avatars', authMiddleware, async (req, res) => {
  try {
    const { name, data } = req.body;
    const result = await runAsync(
      `INSERT INTO avatars (owner, name, data, is_default)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [req.user.id, name || 'My Avatar', JSON.stringify(data || {})]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/avatars/:id', authMiddleware, async (req, res) => {
  try {
    const { name, data } = req.body;
    const row = await getAsync(`SELECT owner FROM avatars WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.owner !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await runAsync(`UPDATE avatars SET name = $1, data = $2 WHERE id = $3`,
      [name || 'Avatar', JSON.stringify(data || {}), req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Games
app.post('/games', authMiddleware, async (req, res) => {
  try {
    const { title, description, genre, maxPlayers, thumbnail } = req.body;
    const result = await runAsync(
      `INSERT INTO games (owner, title, description, metadata, plays, rating)
       VALUES ($1, $2, $3, $4, 0, 0)
       RETURNING id`,
      [req.user.id, title || 'Untitled', description || '', JSON.stringify({ genre, maxPlayers, thumbnail })]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Legacy route: redirect to API list of games
app.get('/games', (req, res) => {
  res.redirect('/api/games');
});

app.get('/search/games', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (query.length < 2) return res.json([]);
    
    const searchTerm = `%${query}%`;
    const rows = await allAsync(
      `SELECT id, owner, title, description, metadata, plays, rating, published FROM games
       WHERE title ILIKE $1 OR description ILIKE $2
       ORDER BY plays DESC LIMIT 10`,
      [searchTerm, searchTerm]
    );
    
    res.json(rows.map(r => ({
      id: r.id,
      owner: r.owner,
      title: r.title || r.name,
      name: r.title || r.name,
      description: r.description,
      ...JSON.parse(r.metadata || '{}'),
      plays: r.plays || 0,
      rating: r.rating || 0,
      published: !!r.published
    })));
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Search users
app.get('/search/users', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (query.length < 2) return res.json([]);
    const searchTerm = `%${query}%`;
    const rows = await allAsync(`SELECT id, username, created_at FROM users WHERE username ILIKE $1 LIMIT 10`, [searchTerm]);
    res.json(rows.map(r => ({ id: r.id, username: r.username, created_at: r.created_at })));
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/games/:id', async (req, res) => {
  try {
    const row = await getAsync(`SELECT * FROM games WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const meta = JSON.parse(row.metadata || '{}');
    res.json({
      id: row.id,
      owner: row.owner,
      title: row.title,
      description: row.description,
      genre: meta.genre,
      maxPlayers: meta.maxPlayers,
      thumbnail: meta.thumbnail,
      plays: row.plays || 0,
      rating: row.rating || 0,
      published: !!row.published,
      favorites: 0,
      created_at: row.created_at || new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/games/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, genre, maxPlayers, thumbnail } = req.body;
    const row = await getAsync(`SELECT owner FROM games WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.owner !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    await runAsync(`UPDATE games SET title = $1, description = $2, metadata = $3 WHERE id = $4`,
      [title, description, JSON.stringify({ genre, maxPlayers, thumbnail }), req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/games/:id', authMiddleware, async (req, res) => {
  try {
    const row = await getAsync(`SELECT owner FROM games WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.owner !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    await runAsync(`DELETE FROM games WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/games/:id/publish', authMiddleware, async (req, res) => {
  try {
    const row = await getAsync(`SELECT owner, published FROM games WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.owner !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    const newStatus = row.published ? 0 : 1;
    await runAsync(`UPDATE games SET published = $1 WHERE id = $2`, [newStatus, req.params.id]);
    res.json({ ok: true, published: !!newStatus });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Economy
app.post('/purchase', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const value = parseInt(amount, 10) || 0;
    if (value <= 0) return res.status(400).json({ error: 'Invalid amount' });
    await runAsync(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [value, req.user.id]);
    await runAsync(`INSERT INTO transactions (user_id, amount, type) VALUES ($1, $2, $3)`,
      [req.user.id, value, 'purchase']);
    res.json({ ok: true, added: value });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/payment/create-checkout', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'Missing amount' });
    res.json({ checkoutId: `stub_${Date.now()}`, amount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Creabux / Currency endpoints
app.get('/creabux', authMiddleware, async (req, res) => {
  try {
    const row = await getAsync(`SELECT creabux FROM users WHERE id = $1`, [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ creabux: row.creabux });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/creabux/purchase', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    // In a real app, integrate with payment processor
    // For now, just update balance for demo
    await runAsync(`UPDATE users SET creabux = creabux + $1 WHERE id = $2 AND is_admin = FALSE`, 
      [amount, req.user.id]);
    res.json({ ok: true, creabux: amount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/payment/webhook', (req, res) => {
  console.log('payment webhook', req.body);
  res.json({ ok: true });
});

// Moderation
async function adminMiddleware(req, res, next) {
  try {
    const row = await getAsync(`SELECT is_admin FROM users WHERE id = $1`, [req.user.id]);
    if (!row || !row.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  } catch (err) {
    res.status(403).json({ error: 'Forbidden' });
  }
}

app.post('/report', authMiddleware, async (req, res) => {
  try {
    const { content_type, content_id, reason } = req.body;
    const result = await runAsync(
      `INSERT INTO reports (reporter, content_type, content_id, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [req.user.id, content_type, content_id, reason || '']
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/admin/reports', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rows = await allAsync(`SELECT * FROM reports ORDER BY created_at DESC`);
    res.json({ reports: rows });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/admin/assets/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await runAsync(`DELETE FROM assets WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/admin/games/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await runAsync(`DELETE FROM games WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// API endpoint to get all games
app.get('/api/games', async (req, res) => {
  try {
    const rows = await allAsync(`SELECT id, owner, title, description, metadata, plays, rating, published, created_at FROM games WHERE published = TRUE ORDER BY plays DESC`);
    const games = rows.map(r => {
      const meta = JSON.parse(r.metadata || '{}');
      return {
        id: r.id,
        owner: r.owner,
        title: r.title,
        name: r.title,
        description: r.description,
        plays: r.plays || 0,
        rating: r.rating || 0,
        published: !!r.published,
        created_at: r.created_at,
        ...meta
      };
    });
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// API endpoint to get game details
app.get('/api/games/:id', async (req, res) => {
  try {
    const row = await getAsync(`SELECT * FROM games WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const meta = JSON.parse(row.metadata || '{}');
    res.json({
      id: row.id,
      owner: row.owner,
      title: row.title,
      description: row.description,
      genre: meta.genre,
      maxPlayers: meta.maxPlayers,
      thumbnail: meta.thumbnail,
      plays: row.plays || 0,
      rating: row.rating || 0,
      published: !!row.published,
      favorites: 0,
      created_at: row.created_at || new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// API endpoint to get user profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const row = await getAsync(`SELECT id, username, balance, creabux, is_admin, created_at FROM users WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: row.id,
      username: row.username,
      balance: row.balance,
      creabux: row.creabux,
      is_admin: !!row.is_admin,
      created_at: row.created_at || new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// API endpoint to get user's games
app.get('/api/users/:id/games', async (req, res) => {
  try {
    const rows = await allAsync(`SELECT id, owner, title, description, metadata, plays, rating, published, created_at FROM games WHERE owner = $1 ORDER BY created_at DESC`, [req.params.id]);
    const games = rows.map(r => {
      const meta = JSON.parse(r.metadata || '{}');
      return {
        id: r.id,
        owner: r.owner,
        title: r.title,
        description: r.description,
        plays: r.plays || 0,
        rating: r.rating || 0,
        published: !!r.published,
        created_at: r.created_at,
        ...meta
      };
    });
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// API endpoint to increment play count
app.post('/api/games/:id/play', async (req, res) => {
  try {
    await runAsync(`UPDATE games SET plays = plays + 1 WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// API endpoint for current user
app.get('/api/user', authMiddleware, async (req, res) => {
  try {
    const row = await getAsync(`SELECT id, username, balance, creabux, is_admin FROM users WHERE id = $1`, [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ id: row.id, username: row.username, balance: row.balance, creabux: row.creabux, is_admin: !!row.is_admin });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve game detail page with friendly URL
app.get('/games/:id/:title', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Serve player profile page with friendly URL
app.get('/player/:id/:username', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// Serve game detail at /:id/:title (e.g., /1/Creatix)
app.get(/^\/(\d+)\/([^/]+)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Custom rewrites (pretty URLs -> static files)
const rewrites = [
  { source: '/profil', destination: '/profil.html' },
  { source: '/panier', destination: '/panier.html' },
  { source: '/home', destination: '/index.html' },
  { source: '/clothes', destination: '/clothes/index.html' },
  { source: '/void-corner', destination: '/corner/index.html' },
  { source: '/void-corner/digital-kiss', destination: '/corner/digital_kiss/index.html' },
  { source: '/void-corner/void-notes', destination: '/corner/void_notes/index.html' },
  { source: '/void-corner/alt-bundles', destination: '/corner/bundles/index.html' },
  { source: '/bundles/alt-starter', destination: '/corner/bundles/starter/index.html' },
  { source: '/bundles/void-bundles', destination: '/corner/bundles/void_bundles/index.html' },
  { source: '/bundles/exclusive-kiss', destination: '/corner/bundles/exclu_kiss/index.html' },
  { source: '/void-corner/void-notes/void-forum', destination: '/corner/void_notes/forum/index.html' },
  { source: '/void-corner/void-notes/ton-style', destination: '/corner/void_notes/ton_style/index.html' },
  { source: '/void-corner/void-notes/notre-histoire', destination: '/corner/void_notes/histoire/index.html' }
];

for (const r of rewrites) {
  app.get(r.source, (req, res) => {
    const dest = r.destination.replace(/^\//, '');
    const p = path.join(__dirname, 'public', dest);
    // if file exists serve it, otherwise 404
    res.sendFile(p, err => {
      if (err) res.status(404).send('Not found');
    });
  });
}

// Serve login at /login for compatibility with redirects
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve uploads
app.use('/uploads', express.static(uploadsDir));

// Socket.io
io.on('connection', (socket) => {
  socket.on('joinRoom', (room) => socket.join(room));
  socket.on('chatMessage', ({ room, message, user }) => {
    io.to(room).emit('chatMessage', { user, message, ts: Date.now() });
  });
  socket.on('signal', (data) => {
    const { to } = data;
    io.to(to).emit('signal', Object.assign({}, data, { from: socket.id }));
  });

  socket.on('game:join', (payload) => {
    const { gameId, userId, username, colors, pos } = payload || {};
    const room = `game:${gameId}`;
    socket.join(room);
    const player = {
      id: socket.id,
      userId,
      username,
      colors,
      pos: pos || { x: 50, y: 85 }
    };
    livePlayers.set(socket.id, { room, player });
    const others = [];
    for (const [id, entry] of livePlayers.entries()) {
      if (id === socket.id) continue;
      if (entry.room === room) others.push(entry.player);
    }
    socket.emit('game:players', others);
    socket.to(room).emit('game:player-joined', player);
  });

  socket.on('game:pos', ({ gameId, pos }) => {
    const entry = livePlayers.get(socket.id);
    if (!entry) return;
    entry.player.pos = pos;
    socket.to(entry.room).emit('game:pos', { id: socket.id, pos });
  });

  socket.on('voice:offer', ({ to, offer }) => {
    io.to(to).emit('voice:offer', { from: socket.id, offer });
  });

  socket.on('voice:answer', ({ to, answer }) => {
    io.to(to).emit('voice:answer', { from: socket.id, answer });
  });

  socket.on('voice:ice', ({ to, candidate }) => {
    io.to(to).emit('voice:ice', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    const entry = livePlayers.get(socket.id);
    if (entry) {
      socket.to(entry.room).emit('game:player-left', { id: socket.id });
      livePlayers.delete(socket.id);
    }
  });
});

// Start server
(async () => {
  try {
    await initDB();
    server.listen(PORT, () => console.log(`\n✓ Server running on http://localhost:${PORT}\n`));
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
})();
