-- Jotter Database Schema
-- MySQL 8.0+
-- Root password: 123456

CREATE DATABASE IF NOT EXISTS jotter_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jotter_db;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  hashed_password VARCHAR(255) NOT NULL,
  encrypted_master_key TEXT,
  kdf_salt VARCHAR(255),
  recovery_bundle TEXT,
  is_active TINYINT(1) DEFAULT 1,
  is_verified TINYINT(1) DEFAULT 0,
  last_login_at DATETIME(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active TINYINT(1) DEFAULT 1,
  last_active_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at DATETIME(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_token (refresh_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  is_used TINYINT(1) DEFAULT 0,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notebooks (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  encrypted_title TEXT NOT NULL,
  encrypted_description TEXT,
  color VARCHAR(20),
  icon VARCHAR(50),
  cover_file_id VARCHAR(36),
  sort_order INT DEFAULT 0,
  is_pinned TINYINT(1) DEFAULT 0,
  is_archived TINYINT(1) DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  sync_version INT DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notebooks_user (user_id),
  INDEX idx_notebooks_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  notebook_id VARCHAR(36),
  note_type VARCHAR(30) NOT NULL DEFAULT 'rich',
  encrypted_title TEXT,
  encrypted_payload LONGTEXT NOT NULL,
  encrypted_note_key TEXT,
  encryption_version INT DEFAULT 1,
  encryption_algorithm VARCHAR(30) DEFAULT 'AES-GCM',
  iv VARCHAR(255),
  content_hash VARCHAR(255),
  color VARCHAR(20),
  icon VARCHAR(50),
  source_url TEXT,
  reminder_at DATETIME(6),
  due_at DATETIME(6),
  is_pinned TINYINT(1) DEFAULT 0,
  is_favorite TINYINT(1) DEFAULT 0,
  is_archived TINYINT(1) DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  sync_version INT DEFAULT 1,
  client_updated_at DATETIME(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE SET NULL,
  INDEX idx_notes_user (user_id),
  INDEX idx_notes_client (client_id),
  INDEX idx_notes_user_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  encrypted_name TEXT NOT NULL,
  color VARCHAR(20),
  usage_count INT DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  sync_version INT DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tags_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS note_tags (
  note_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attachments (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36),
  note_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  encrypted_file_name TEXT,
  encrypted_data LONGTEXT,
  encrypted_search_text LONGTEXT,
  mime_type VARCHAR(100),
  file_size INT,
  storage_path TEXT,
  encrypted_file_key TEXT,
  encryption_algorithm VARCHAR(30) DEFAULT 'AES-GCM',
  iv VARCHAR(255),
  content_hash VARCHAR(255),
  storage_provider VARCHAR(20) DEFAULT 'local',
  sync_version INT DEFAULT 1,
  is_deleted TINYINT(1) DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  note_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  starts_at DATETIME(6) NOT NULL,
  ends_at DATETIME(6),
  location VARCHAR(255),
  attendees TEXT,
  provider VARCHAR(30) DEFAULT 'manual',
  external_id VARCHAR(255),
  is_deleted TINYINT(1) DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL,
  INDEX idx_calendar_user_start (user_id, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shared_notes (
  id VARCHAR(36) PRIMARY KEY,
  note_id VARCHAR(36) NOT NULL,
  owner_user_id VARCHAR(36) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  permission VARCHAR(20) DEFAULT 'view',
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_shared_note_recipient (note_id, recipient_email),
  INDEX idx_shared_owner (owner_user_id),
  INDEX idx_shared_recipient (recipient_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS note_versions (
  id VARCHAR(36) PRIMARY KEY,
  note_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  encrypted_title TEXT,
  encrypted_payload LONGTEXT NOT NULL,
  sync_version INT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_versions_note (note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sync_log (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  operation VARCHAR(20) NOT NULL,
  device_id VARCHAR(36),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sync_log_user (user_id, entity_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS google_drive_connections (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME(6),
  drive_folder_id VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
