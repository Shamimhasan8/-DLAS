// ============================================================================
// DLAS SQLite Data Spine wrapper using native Node.js node:sqlite (DatabaseSync)
// Zero-dependency, thread-safe, synchronous and blazing fast.
// ============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');

const BUNDLED_DB_PATH = path.join(__dirname, '..', 'data', 'dev.db');
const TMP_DATA_DIR = path.join(os.tmpdir(), 'dlas-data');
const TMP_DB_PATH = path.join(TMP_DATA_DIR, 'dev.db');

let activeDbPath = BUNDLED_DB_PATH;

try {
  const dataDir = path.dirname(BUNDLED_DB_PATH);
  fs.mkdirSync(dataDir, { recursive: true });
  // Test write
  const testFile = path.join(dataDir, '.test-' + Date.now() + '.tmp');
  fs.writeFileSync(testFile, '1');
  fs.unlinkSync(testFile);
} catch (e) {
  // Read-only filesystem (e.g. /var/task on Vercel/Lambda)
  activeDbPath = TMP_DB_PATH;
  try {
    fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DB_PATH) && fs.existsSync(BUNDLED_DB_PATH)) {
      fs.copyFileSync(BUNDLED_DB_PATH, TMP_DB_PATH);
    }
  } catch (err) {
    console.warn('[db] Failed copying db to tmp:', err.message);
  }
}

// Open SQLite database
let sqlite;
try {
  sqlite = new DatabaseSync(activeDbPath);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
} catch (err) {
  // If WAL or active path failed, try in tmp or memory
  try {
    fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DB_PATH) && fs.existsSync(BUNDLED_DB_PATH)) {
      try { fs.copyFileSync(BUNDLED_DB_PATH, TMP_DB_PATH); } catch (_) {}
    }
    sqlite = new DatabaseSync(TMP_DB_PATH);
    sqlite.exec('PRAGMA foreign_keys = ON;');
  } catch (innerErr) {
    console.warn('[db] Opening in-memory fallback SQLite database');
    sqlite = new DatabaseSync(':memory:');
  }
}


const db = {
  raw: sqlite,

  query(sql, params = []) {
    try {
      const stmt = sqlite.prepare(sql);
      return stmt.all(...params);
    } catch (err) {
      console.error('[DB Query Error]', err.message, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  },

  all(sql, params = []) {
    return this.query(sql, params);
  },

  get(sql, params = []) {
    try {
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...params);
      return row || null;
    } catch (err) {
      console.error('[DB Get Error]', err.message, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  },

  run(sql, params = []) {
    try {
      const stmt = sqlite.prepare(sql);
      return stmt.run(...params);
    } catch (err) {
      console.error('[DB Run Error]', err.message, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  },

  exec(sql) {
    return sqlite.exec(sql);
  },

  transaction(fn) {
    sqlite.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = fn(db);
      sqlite.exec('COMMIT;');
      return result;
    } catch (err) {
      sqlite.exec('ROLLBACK;');
      throw err;
    }
  },

  nextId(prefix) {
    const year = new Date().getFullYear();
    const key = `${prefix}-${year}`;
    let val = 1;

    // Use transaction to atomically increment Counter
    this.transaction(() => {
      const existing = this.get('SELECT value FROM Counter WHERE key = ?', [key]);
      if (existing) {
        val = existing.value + 1;
        this.run('UPDATE Counter SET value = ? WHERE key = ?', [val, key]);
      } else {
        val = 1;
        this.run('INSERT INTO Counter (key, value) VALUES (?, ?)', [key, val]);
      }
    });

    return `${prefix}-${year}-${String(val).padStart(4, '0')}`;
  }
};

module.exports = db;
