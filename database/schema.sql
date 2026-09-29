-- Reference schema. The server creates these tables automatically on startup.
-- Create the database first with an administrator account:
-- CREATE DATABASE applytrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Grant a dedicated local user access to this database only.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  expires_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS applications (
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
);
