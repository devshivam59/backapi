-- Migration: Add paper trading tables
-- Date: 2025-10-20
-- Description: Add users, orders, and positions tables for paper trading functionality

-- Users table with virtual funds
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT UNIQUE NOT NULL,
    username TEXT,
    email TEXT,
    virtual_funds_available DECIMAL(20, 2) DEFAULT 1000000.00,  -- ₹10 Lakhs default
    virtual_funds_used DECIMAL(20, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_token ON users(user_token);

-- Orders table (order book)
CREATE TABLE IF NOT EXISTS orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_token TEXT NOT NULL,
    security_id TEXT NOT NULL,
    instrument_symbol TEXT NOT NULL,
    exchange_segment TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
    product_type TEXT NOT NULL CHECK(product_type IN ('INTRADAY', 'DELIVERY')),
    order_type TEXT NOT NULL CHECK(order_type IN ('MARKET', 'LIMIT')),
    quantity INTEGER NOT NULL,
    limit_price DECIMAL(20, 2),
    executed_price DECIMAL(20, 2),
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED')),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_token ON orders(user_token);

-- Positions table (holdings)
CREATE TABLE IF NOT EXISTS positions (
    position_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_token TEXT NOT NULL,
    security_id TEXT NOT NULL,
    instrument_symbol TEXT NOT NULL,
    exchange_segment TEXT NOT NULL,
    product_type TEXT NOT NULL CHECK(product_type IN ('INTRADAY', 'DELIVERY')),
    quantity INTEGER NOT NULL,
    average_price DECIMAL(20, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE(user_id, security_id, exchange_segment, product_type)
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_token ON positions(user_token);
CREATE INDEX IF NOT EXISTS idx_positions_security ON positions(security_id);

-- Migrate existing user_settings to users table
INSERT OR IGNORE INTO users (user_token, virtual_funds_available)
SELECT user_token, 1000000.00
FROM user_settings;

