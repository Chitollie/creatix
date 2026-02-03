/* eslint-disable no-console */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const args = process.argv.slice(2);
const sqliteArgIndex = args.findIndex(a => a === '--sqlite');
const sqlitePath = sqliteArgIndex >= 0 && args[sqliteArgIndex + 1]
  ? args[sqliteArgIndex + 1]
  : path.join(__dirname, '..', 'data.sqlite');

const truncate = args.includes('--truncate');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it to your Neon connection string.');
  process.exit(1);
}

const useSSL = /sslmode=require/i.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

const openSqlite = (filePath) => new sqlite3.Database(filePath);
const allSqlite = (db, sql, params = []) => new Promise((res, rej) => {
  db.all(sql, params, (err, rows) => (err ? rej(err) : res(rows || [])));
});

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    balance INTEGER DEFAULT 0,
    creabux INTEGER DEFAULT 1000,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    owner INTEGER,
    filename TEXT,
    type TEXT,
    metadata TEXT
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS games (
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
  await pool.query(`CREATE TABLE IF NOT EXISTS avatars (
    id SERIAL PRIMARY KEY,
    owner INTEGER,
    name TEXT,
    data TEXT,
    is_default BOOLEAN DEFAULT FALSE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter INTEGER,
    content_type TEXT,
    content_id INTEGER,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    amount INTEGER,
    type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

async function tableHasData(table) {
  const res = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return res.rows[0]?.c > 0;
}

async function requireEmptyOrTruncate() {
  const tables = ['users', 'assets', 'games', 'avatars', 'reports', 'transactions'];
  if (!truncate) {
    for (const t of tables) {
      if (await tableHasData(t)) {
        console.error(
          `Table "${t}" already has data. Rerun with --truncate to overwrite.`
        );
        process.exit(1);
      }
    }
    return;
  }

  await pool.query(
    'TRUNCATE users, assets, games, avatars, reports, transactions RESTART IDENTITY'
  );
}

async function resetSequences() {
  const seqs = [
    'users_id_seq',
    'assets_id_seq',
    'games_id_seq',
    'avatars_id_seq',
    'reports_id_seq',
    'transactions_id_seq'
  ];

  for (const seq of seqs) {
    const table = seq.replace('_id_seq', '');
    const res = await pool.query(`SELECT COALESCE(MAX(id), 0) AS max_id FROM ${table}`);
    const maxId = parseInt(res.rows[0]?.max_id || 0, 10);
    if (maxId > 0) {
      await pool.query('SELECT setval($1, $2, $3)', [seq, maxId, true]);
    } else {
      // When table is empty, set sequence to 1 with is_called=false.
      await pool.query('SELECT setval($1, $2, $3)', [seq, 1, false]);
    }
  }
}

async function insertUsers(rows) {
  const sql = `
    INSERT INTO users (id, username, password, balance, creabux, is_admin, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  for (const r of rows) {
    await pool.query(sql, [
      r.id,
      r.username,
      r.password,
      r.balance ?? 0,
      r.creabux ?? 1000,
      !!r.is_admin,
      r.created_at
    ]);
  }
}

async function insertAssets(rows) {
  const sql = `
    INSERT INTO assets (id, owner, filename, type, metadata)
    VALUES ($1, $2, $3, $4, $5)
  `;
  for (const r of rows) {
    await pool.query(sql, [r.id, r.owner, r.filename, r.type, r.metadata]);
  }
}

async function insertGames(rows) {
  const sql = `
    INSERT INTO games (id, owner, title, description, metadata, plays, rating, published, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  for (const r of rows) {
    await pool.query(sql, [
      r.id,
      r.owner,
      r.title,
      r.description,
      r.metadata,
      r.plays ?? 0,
      r.rating ?? 0,
      !!r.published,
      r.created_at
    ]);
  }
}

async function insertAvatars(rows) {
  const sql = `
    INSERT INTO avatars (id, owner, name, data, is_default)
    VALUES ($1, $2, $3, $4, $5)
  `;
  for (const r of rows) {
    await pool.query(sql, [
      r.id,
      r.owner,
      r.name,
      r.data,
      !!r.is_default
    ]);
  }
}

async function insertReports(rows) {
  const sql = `
    INSERT INTO reports (id, reporter, content_type, content_id, reason, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  for (const r of rows) {
    await pool.query(sql, [
      r.id,
      r.reporter,
      r.content_type,
      r.content_id,
      r.reason,
      r.created_at
    ]);
  }
}

async function insertTransactions(rows) {
  const sql = `
    INSERT INTO transactions (id, user_id, amount, type, created_at)
    VALUES ($1, $2, $3, $4, $5)
  `;
  for (const r of rows) {
    await pool.query(sql, [
      r.id,
      r.user_id,
      r.amount,
      r.type,
      r.created_at
    ]);
  }
}

async function run() {
  const sqlite = openSqlite(sqlitePath);
  try {
    await ensureSchema();
    await requireEmptyOrTruncate();

    const users = await allSqlite(sqlite, 'SELECT * FROM users');
    const assets = await allSqlite(sqlite, 'SELECT * FROM assets');
    const games = await allSqlite(sqlite, 'SELECT * FROM games');
    const avatars = await allSqlite(sqlite, 'SELECT * FROM avatars');
    const reports = await allSqlite(sqlite, 'SELECT * FROM reports');
    const transactions = await allSqlite(sqlite, 'SELECT * FROM transactions');

    await insertUsers(users);
    await insertAssets(assets);
    await insertGames(games);
    await insertAvatars(avatars);
    await insertReports(reports);
    await insertTransactions(transactions);

    await resetSequences();

    console.log('✓ Migration complete');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    sqlite.close();
    await pool.end();
  }
}

run();
