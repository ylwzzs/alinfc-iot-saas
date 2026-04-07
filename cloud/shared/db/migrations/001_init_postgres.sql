-- 支付宝 IoT 设备数据 SaaS 平台 - PostgreSQL 初始化脚本
-- 在 Vercel Postgres 中执行此脚本

-- ============================================================
-- 管理员用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  real_name VARCHAR(50),
  status SMALLINT DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始管理员（密码: admin123）
INSERT INTO admin_users (username, password, real_name)
VALUES ('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- 租户表
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  contact_name VARCHAR(50),
  contact_phone VARCHAR(20),
  app_auth_token TEXT,
  authorization_status VARCHAR(20) DEFAULT 'pending',
  authorized_at TIMESTAMP,
  last_sync_at TIMESTAMP,
  device_count INT DEFAULT 0,
  status SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 设备表
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  sn VARCHAR(50) NOT NULL,
  store_id VARCHAR(100),
  device_type VARCHAR(50),
  province_name VARCHAR(20),
  city_name VARCHAR(20),
  status SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 设备指标数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS device_metrics (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  metrics_date DATE NOT NULL,
  sn VARCHAR(50) NOT NULL,
  store_id VARCHAR(100),
  alipay_amount DECIMAL(12,2) DEFAULT 0.00,
  alipay_transaction_count INT DEFAULT 0,
  nfc_amount DECIMAL(12,2) DEFAULT 0.00,
  nfc_transaction_count INT DEFAULT 0,
  province_name VARCHAR(20),
  city_name VARCHAR(20),
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 数据同步日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  metrics_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_records INT DEFAULT 0,
  synced_records INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_device_metrics_tenant_date ON device_metrics(tenant_id, metrics_date);
CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant_date ON sync_logs(tenant_id, metrics_date);
