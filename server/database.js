import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export async function openDatabase(options = {}) {
  const driver = options.driver || process.env.DB_DRIVER || 'sqlite';
  let db;
  if (driver === 'mysql') {
    const { createPool } = await import('mysql2/promise');
    const pool = createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'applytrack',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || 'applytrack',
      connectionLimit: 5, supportBigNumbers: true, bigNumberStrings: false,
      charset: 'utf8mb4'
    });
    db = {
      all: async (sql, params = []) => (await pool.execute(sql, params))[0],
      run: async (sql, params = []) => (await pool.execute(sql, params))[0],
      close: () => pool.end()
    };
  } else if (driver === 'sqlite') {
    const { DatabaseSync } = await import('node:sqlite');
    const filename = options.filename || resolve('data/applytrack.sqlite');
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    const sqlite = new DatabaseSync(filename);
    sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    db = {
      all: async (sql, params = []) => sqlite.prepare(sql).all(...params),
      run: async (sql, params = []) => sqlite.prepare(sql).run(...params),
      close: async () => sqlite.close()
    };
  } else throw new Error('DB_DRIVER must be mysql or sqlite');

  // The portable SQL subset keeps the local demo and MySQL behavior aligned.
  await db.run(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  )`);
  await db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    expires_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await db.run(`CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    company VARCHAR(100) NOT NULL,
    role VARCHAR(150) NOT NULL,
    location VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL,
    applied_on VARCHAR(10) NOT NULL,
    job_url VARCHAR(1000) NOT NULL,
    notes TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  if (driver === 'sqlite') {
    await db.run('CREATE INDEX IF NOT EXISTS applications_user_idx ON applications(user_id)');
    await db.run('CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)');
  }
  db.get = async (sql, params = []) => (await db.all(sql, params))[0];
  return db;
}
