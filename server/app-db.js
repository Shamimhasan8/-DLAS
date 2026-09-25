'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const BUNDLED_DATA_DIR = path.join(__dirname, '..', 'data');
const BUNDLED_DB_PATH = path.join(BUNDLED_DATA_DIR, 'app-db.json');

const TMP_DATA_DIR = path.join(os.tmpdir(), 'dlas-data');
const TMP_DB_PATH = path.join(TMP_DATA_DIR, 'app-db.json');

// Check if a directory is writable
function isDirWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const testFile = path.join(dir, '.write-test-' + Date.now() + '.tmp');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
}

// Determine active paths
let activeDataDir = BUNDLED_DATA_DIR;
let activeDbPath = BUNDLED_DB_PATH;

if (!isDirWritable(BUNDLED_DATA_DIR)) {
  activeDataDir = TMP_DATA_DIR;
  activeDbPath = TMP_DB_PATH;
}

function emptyDb() {
  return {
    users: [],
    sessions: {},
    applications: [],
    complaints: [],
    chatlogs: [],
    otps: {},
    counters: { application: 4417, complaint: 100, user: 1, case: 900 }
  };
}

let db = null;

function load() {
  if (db) return db;

  // 1. Check if temporary/runtime updated DB exists
  if (fs.existsSync(TMP_DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(TMP_DB_PATH, 'utf8'));
      return db;
    } catch (e) {}
  }

  // 2. Check bundled DB
  if (fs.existsSync(BUNDLED_DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(BUNDLED_DB_PATH, 'utf8'));
      return db;
    } catch (e) {}
  }

  // 3. Check Front bundled DB
  const frontDb = path.join(__dirname, '..', 'Front', 'server', 'data', 'db.json');
  if (fs.existsSync(frontDb)) {
    try {
      db = JSON.parse(fs.readFileSync(frontDb, 'utf8'));
      save();
      return db;
    } catch (err) {}
  }

  db = emptyDb();
  save();
  return db;
}

function save() {
  if (!db) return;
  try {
    fs.mkdirSync(activeDataDir, { recursive: true });
    const tmp = activeDbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    try {
      fs.renameSync(tmp, activeDbPath);
    } catch (err) {
      fs.copyFileSync(tmp, activeDbPath);
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
  } catch (err) {
    // If primary active path failed (e.g. EROFS on /var/task), switch to os.tmpdir()
    if (activeDataDir !== TMP_DATA_DIR) {
      activeDataDir = TMP_DATA_DIR;
      activeDbPath = TMP_DB_PATH;
      try {
        fs.mkdirSync(activeDataDir, { recursive: true });
        const tmp = activeDbPath + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
        try {
          fs.renameSync(tmp, activeDbPath);
        } catch (e) {
          fs.copyFileSync(tmp, activeDbPath);
          try { fs.unlinkSync(tmp); } catch (_) {}
        }
      } catch (innerErr) {
        console.warn('[app-db] Fallback save failed, persisting in-memory only:', innerErr.message);
      }
    } else {
      console.warn('[app-db] Save failed, persisting in-memory only:', err.message);
    }
  }
}

function hashPassword(pw) {
  return require('crypto').createHash('sha256').update('dlas-salt::' + pw).digest('hex');
}

function nextId(kind, prefix, year) {
  const d = load();
  d.counters[kind] = (d.counters[kind] || 1000) + 1;
  return `${prefix}-${year || 2026}-${String(d.counters[kind]).padStart(5, '0')}`;
}

module.exports = {
  load,
  save,
  hashPassword,
  nextId,
  DB_PATH: activeDbPath,
  // Defensive fallbacks in case called as db.get / db.query
  get(sql, params) {
    try {
      const sqlite = require('./db');
      if (sqlite && typeof sqlite.get === 'function') return sqlite.get(sql, params);
    } catch (_) {}
    return null;
  },
  query(sql, params) {
    try {
      const sqlite = require('./db');
      if (sqlite && typeof sqlite.query === 'function') return sqlite.query(sql, params);
    } catch (_) {}
    return [];
  }
};

