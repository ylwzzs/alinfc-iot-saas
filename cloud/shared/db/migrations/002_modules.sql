-- ============================================================
-- 模块管理相关表
-- ============================================================

-- 系统模块表
CREATE TABLE IF NOT EXISTS system_modules (
  id VARCHAR(50) PRIMARY KEY COMMENT '模块ID',
  name VARCHAR(100) NOT NULL COMMENT '模块名称',
  description VARCHAR(500) COMMENT '模块描述',
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  icon VARCHAR(100) COMMENT '图标',
  route VARCHAR(100) COMMENT '前端路由',
  permissions JSON COMMENT '所需权限列表',
  dependencies JSON COMMENT '依赖模块列表',
  is_core TINYINT(1) DEFAULT 0 COMMENT '是否核心模块',
  status ENUM('active','deprecated','development') DEFAULT 'active' COMMENT '状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status (status),
  KEY idx_is_core (is_core)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统模块表';

-- 租户模块权限表
CREATE TABLE IF NOT EXISTS tenant_modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  module_id VARCHAR(50) NOT NULL COMMENT '模块ID',
  enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  config JSON COMMENT '模块配置',
  expires_at DATETIME COMMENT '过期时间（按需收费）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_module (tenant_id, module_id),
  KEY idx_enabled (enabled),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES system_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块权限表';

-- 同步断点表
CREATE TABLE IF NOT EXISTS sync_checkpoints (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  metrics_date DATE NOT NULL COMMENT '同步的数据日期',
  last_page INT DEFAULT 0 COMMENT '最后成功页码',
  total_pages INT DEFAULT 0 COMMENT '总页数',
  total_records INT DEFAULT 0 COMMENT '总记录数',
  synced_records INT DEFAULT 0 COMMENT '已同步记录数',
  status ENUM('pending','running','completed','failed') DEFAULT 'pending' COMMENT '同步状态',
  error_message TEXT COMMENT '错误信息',
  started_at DATETIME COMMENT '开始时间',
  finished_at DATETIME COMMENT '完成时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_date (tenant_id, metrics_date),
  KEY idx_status (status),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据同步断点表';

-- 设备指标模板表（用于创建分表）
CREATE TABLE IF NOT EXISTS device_metrics_template (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  metrics_date DATE NOT NULL COMMENT '统计日期',
  sn VARCHAR(50) NOT NULL COMMENT '设备SN号',
  store_id VARCHAR(100) COMMENT '外部门店号',
  device_type VARCHAR(50) COMMENT '设备类型',
  device_system VARCHAR(50) COMMENT '设备系统',
  province_code VARCHAR(10) COMMENT '省份编码',
  province_name VARCHAR(20) COMMENT '省份名称',
  city_code VARCHAR(10) COMMENT '城市编码',
  city_name VARCHAR(20) COMMENT '城市名称',
  district_code VARCHAR(10) COMMENT '区县编码',
  district_name VARCHAR(20) COMMENT '区县名称',
  location_address VARCHAR(200) COMMENT '位置地址',
  binding_location VARCHAR(100) COMMENT '绑定位置',
  alipay_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '支付宝交易金额',
  alipay_transaction_count INT DEFAULT 0 COMMENT '支付宝交易笔数',
  effective_alipay_transaction_count INT DEFAULT 0 COMMENT '有效支付宝交易笔数',
  nfc_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT 'NFC交易金额',
  nfc_transaction_count INT DEFAULT 0 COMMENT 'NFC交易笔数',
  effective_nfc_transaction_count INT DEFAULT 0 COMMENT '有效NFC交易笔数',
  refund_order_amt DECIMAL(12,2) DEFAULT 0.00 COMMENT '退款订单金额',
  refund_order_cnt INT DEFAULT 0 COMMENT '退款订单数',
  real_refund_fee DECIMAL(12,2) DEFAULT 0.00 COMMENT '实际退款金额',
  real_consume_fee DECIMAL(12,2) DEFAULT 0.00 COMMENT '实际消费金额',
  be_register TINYINT(1) DEFAULT 0 COMMENT '是否已注册',
  register_time DATETIME COMMENT '注册时间',
  be_lighted_up TINYINT(1) DEFAULT 0 COMMENT '是否已点亮',
  light_up_time DATETIME COMMENT '点亮时间',
  be_turnon_device TINYINT(1) DEFAULT 0 COMMENT '是否开机',
  effective_turnon_device TINYINT(1) DEFAULT 0 COMMENT '有效开机',
  do_check_in TINYINT(1) DEFAULT 0 COMMENT '是否签到',
  last_30_valid_boot_days VARCHAR(10) DEFAULT '0' COMMENT '近30天有效开机天数',
  last_30_sales_over_2_days VARCHAR(10) DEFAULT '0' COMMENT '近30天销售额超2元天数',
  last_30_checkin_days VARCHAR(10) DEFAULT '0' COMMENT '近30天签到天数',
  last_7_checkin_days VARCHAR(10) DEFAULT '0' COMMENT '近7天签到天数',
  cont_non_turnon_days_mtd VARCHAR(10) DEFAULT '0' COMMENT '本月连续未开机天数',
  total_lighted_months VARCHAR(10) DEFAULT '0' COMMENT '累计点亮月数',
  raw_data JSON COMMENT '接口原始返回完整数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '同步时间',
  UNIQUE KEY uk_date_sn (metrics_date, sn),
  KEY idx_date_store (metrics_date, store_id),
  KEY idx_date_province (metrics_date, province_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备日维度指标数据模板表';
