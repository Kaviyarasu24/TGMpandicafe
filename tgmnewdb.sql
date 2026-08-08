-- =========================================================================
-- TGM PANDI CAFE — MySQL Database Schema
-- =========================================================================
-- Faithful MySQL port of the schema created at runtime by
-- backend/database.js -> createTables(). Run against a fresh MySQL 8.0+
-- database. Safe to re-run: uses CREATE TABLE IF NOT EXISTS / INSERT IGNORE.
--
--   mysql -u <user> -p < tgmnewdb.sql
--   -- or, into a specific database:
--   mysql -u <user> -p tgmpandicafe < tgmnewdb.sql
--
-- Notes on the Postgres -> MySQL translation:
--   SERIAL PRIMARY KEY          -> INT AUTO_INCREMENT PRIMARY KEY
--   TIMESTAMPTZ DEFAULT NOW()   -> TIMESTAMP DEFAULT CURRENT_TIMESTAMP
--   JSONB                       -> JSON
--   ON CONFLICT (col) DO NOTHING-> INSERT IGNORE (requires the UNIQUE key)
--   The bills.status / void_reason ALTERs are folded into the table below.
-- =========================================================================

-- Create and select the database (edit the name if you prefer another).
CREATE DATABASE IF NOT EXISTS tgmcafe
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tgmcafe;

-- =========================================================================
-- 1. Tables
-- =========================================================================

-- Menu Table
CREATE TABLE IF NOT EXISTS menu (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255)  NOT NULL,
  category    VARCHAR(255)  NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  stock_count INT           NOT NULL,
  min_stock   INT           NOT NULL DEFAULT 10,
  image_url   TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bills Table (status + void_reason included for void support)
CREATE TABLE IF NOT EXISTS bills (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  bill_number    VARCHAR(255)  NOT NULL UNIQUE,
  date_time      VARCHAR(255)  NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  tax            DECIMAL(10,2) NOT NULL,
  total          DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50)   NOT NULL,
  status         VARCHAR(50)   NOT NULL DEFAULT 'completed',
  void_reason    TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bill Items Table
CREATE TABLE IF NOT EXISTS bill_items (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  bill_id   INT           NOT NULL,
  item_id   INT           NOT NULL,
  item_name VARCHAR(255)  NOT NULL,
  quantity  INT           NOT NULL,
  price     DECIMAL(10,2) NOT NULL,
  total     DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  date        VARCHAR(50)   NOT NULL,
  description TEXT          NOT NULL,
  quantity    DECIMAL(10,2) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  total       DECIMAL(10,2) NOT NULL,
  category    VARCHAR(255)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inventory Logs Table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  date              VARCHAR(50)   NOT NULL,
  time              VARCHAR(50)   NOT NULL,
  bill_number       VARCHAR(255)  NOT NULL,
  item_name         VARCHAR(255)  NOT NULL,
  previous_stock    DECIMAL(10,2) NOT NULL,
  restored_quantity DECIMAL(10,2) NOT NULL,
  updated_stock     DECIMAL(10,2) NOT NULL,
  action            VARCHAR(255)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL UNIQUE,
  pricing_type VARCHAR(50)  NOT NULL,
  weight_unit  VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL,
  full_name     VARCHAR(255),
  email         VARCHAR(255),
  mobile        VARCHAR(50),
  theme         VARCHAR(50) DEFAULT 'light'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Logs Table — records who did what, for accountability
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  username   VARCHAR(255),
  role       VARCHAR(50),
  action     VARCHAR(100) NOT NULL,
  entity     VARCHAR(100) NOT NULL,
  entity_id  VARCHAR(100),
  details    TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Held / Parked Orders Table — cashier can save a cart and resume later
CREATE TABLE IF NOT EXISTS held_orders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  label      VARCHAR(255) NOT NULL,
  created_by VARCHAR(255),
  cart_data  JSON         NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 2. Seed default categories (matches database.js defaultCats)
-- =========================================================================
INSERT IGNORE INTO categories (name, pricing_type, weight_unit) VALUES
  ('Hot Drinks',         'fixed',  NULL),
  ('Milk Shake',         'fixed',  NULL),
  ('Mojito',             'fixed',  NULL),
  ('Chat Items',         'fixed',  NULL),
  ('Scopes',             'fixed',  NULL),
  ('Juice',              'fixed',  NULL),
  ('Cooling',            'fixed',  NULL),
  ('Starter (Veg)',      'fixed',  NULL),
  ('Rice & Noodle',      'fixed',  NULL),
  ('Starter (Non-Veg)',  'fixed',  NULL),
  ('Desserts',           'fixed',  NULL),
  ('Savories',           'weight', '100g'),
  ('Sweets',             'weight', '1kg');

-- =========================================================================
-- 3. Seed default users (admin / sales)
-- =========================================================================
-- Both accounts have the password: password
-- The hash below is a bcrypt hash of 'password' (cost 10), compatible with
-- the backend's bcryptjs bcrypt.compare(). CHANGE THESE PASSWORDS after first
-- login in a real deployment.
INSERT IGNORE INTO users (username, password_hash, role, full_name) VALUES
  ('admin', '$2b$10$jqA5ezbEQ4zjn4qhaaGXBuOiSNJemaPJshanlZElonB321Ys./YHm', 'admin', 'System Administrator'),
  ('sales', '$2b$10$jqA5ezbEQ4zjn4qhaaGXBuOiSNJemaPJshanlZElonB321Ys./YHm', 'sales', 'Sales Staff');

-- =========================================================================
-- 4. Seed default menu items (optional; from tgmcafe.sql)
-- =========================================================================
-- min_stock defaults to 10 and image_url stays NULL for these.
INSERT INTO menu (name, category, price, stock_count) VALUES
  -- Hot Drinks
  ('Tea', 'Hot Drinks', 15, 1000),
  ('Coffee', 'Hot Drinks', 20, 1000),
  ('Ginger Tea', 'Hot Drinks', 20, 1000),
  ('Masala Tea', 'Hot Drinks', 25, 1000),
  ('Lemon Tea', 'Hot Drinks', 20, 1000),
  ('Green Tea', 'Hot Drinks', 30, 1000),
  ('Boost', 'Hot Drinks', 35, 1000),
  ('Horlicks', 'Hot Drinks', 35, 1000),
  -- Chat Items
  ('Pani Puri', 'Chat Items', 30, 99),
  ('Masal Puri', 'Chat Items', 30, 99),
  ('Bhel Puri', 'Chat Items', 40, 99),
  ('Dahi Puri', 'Chat Items', 50, 99),
  ('Samosa Chat', 'Chat Items', 50, 99),
  ('Kalan', 'Chat Items', 50, 99),
  ('Cauliflower Chilli', 'Chat Items', 50, 98),
  ('Chicken Chill', 'Chat Items', 60, 98),
  -- Milk Shake
  ('Chocolate Shake', 'Milk Shake', 90, 50),
  ('Vanilla Shake', 'Milk Shake', 80, 50),
  ('Strawberry Shake', 'Milk Shake', 80, 50),
  ('Pista Shake', 'Milk Shake', 90, 50),
  ('Badam Shake', 'Milk Shake', 100, 50),
  ('Oreo Shake', 'Milk Shake', 110, 50),
  -- Cooling / Cold Drinks
  ('Badam Milk', 'Cooling', 30, 99),
  ('Boost (Cold)', 'Cooling', 50, 100),
  ('Cold Coffee', 'Cooling', 70, 94),
  ('Rose Milk', 'Cooling', 40, 100),
  ('Lassi', 'Cooling', 50, 50),
  -- Starters
  ('French Fries', 'Starter (Veg)', 80, 50),
  ('Cheese Fries', 'Starter (Veg)', 100, 50),
  ('Veg Nuggets', 'Starter (Veg)', 90, 50),
  ('Chicken Nuggets', 'Starter (Non-Veg)', 120, 50),
  ('Chicken Popcorn', 'Starter (Non-Veg)', 130, 50),
  -- Rice & Noodles
  ('Veg Fried Rice', 'Rice & Noodle', 100, 50),
  ('Egg Fried Rice', 'Rice & Noodle', 120, 50),
  ('Chicken Fried Rice', 'Rice & Noodle', 140, 50),
  ('Veg Noodles', 'Rice & Noodle', 100, 50),
  ('Egg Noodles', 'Rice & Noodle', 120, 50),
  ('Chicken Noodles', 'Rice & Noodle', 140, 50),
  -- Savories (by weight)
  ('Murukku', 'Savories', 30, 1000),
  ('Kara Boondi', 'Savories', 25, 1000),
  ('Mixture', 'Savories', 35, 1000),
  ('Pakoda', 'Savories', 40, 1000);
