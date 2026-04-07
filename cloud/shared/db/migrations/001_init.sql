-- 支付宝 IoT 设备数据 SaaS 平台 - 数据库初始化脚本
-- 数据库编码: utf8mb4

CREATE DATABASE IF NOT EXISTS alinfc DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE alinfc;

-- ============================================================
-- 管理员用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL COMMENT '管理员账号',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希（bcrypt）',
  real_name VARCHAR(50) COMMENT '真实姓名',
  status TINYINT(1) DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  last_login_at DATETIME COMMENT '最后登录时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员用户表';

-- 初始管理员（密码: admin123，实际部署时请修改）
INSERT INTO admin_users (username, password_hash, real_name) VALUES
('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员');

-- ============================================================
-- 租户表
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '租户名称',
  contact_name VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  app_auth_token TEXT COMMENT '支付宝授权令牌（AES加密存储）',
  app_auth_token_expires_at DATETIME COMMENT 'token 过期时间',
  refresh_token TEXT COMMENT '刷新令牌（AES加密存储）',
  authorization_status ENUM('pending','authorizing','authorized','expired','disabled') DEFAULT 'pending' COMMENT '授权状态',
  authorized_at DATETIME COMMENT '授权时间',
  last_sync_at DATETIME COMMENT '最后同步时间',
  last_sync_status ENUM('success','failed','syncing','never') DEFAULT 'never' COMMENT '最后同步状态',
  last_sync_error TEXT COMMENT '最后同步错误信息',
  device_count INT DEFAULT 0 COMMENT '设备数量',
  status TINYINT(1) DEFAULT 1 COMMENT '租户状态: 1-启用, 0-禁用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name),
  KEY idx_auth_status (authorization_status),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表';

-- ============================================================
-- 设备日维度指标数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS device_metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  metrics_date DATE NOT NULL COMMENT '统计日期',

  -- 设备基本信息
  sn VARCHAR(50) NOT NULL COMMENT '设备SN号',
  store_id VARCHAR(100) COMMENT '外部门店号',
  device_type VARCHAR(50) COMMENT '设备类型',
  device_system VARCHAR(50) COMMENT '设备系统',

  -- 地理位置
  province_code VARCHAR(10) COMMENT '省份编码',
  province_name VARCHAR(20) COMMENT '省份名称',
  city_code VARCHAR(10) COMMENT '城市编码',
  city_name VARCHAR(20) COMMENT '城市名称',
  district_code VARCHAR(10) COMMENT '区县编码',
  district_name VARCHAR(20) COMMENT '区县名称',
  location_address VARCHAR(200) COMMENT '位置地址',
  binding_location VARCHAR(100) COMMENT '绑定位置',

  -- 支付宝交易指标
  alipay_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '支付宝交易金额',
  alipay_transaction_count INT DEFAULT 0 COMMENT '支付宝交易笔数',
  effective_alipay_transaction_count INT DEFAULT 0 COMMENT '有效支付宝交易笔数',
  alipay_amt_2_restrict_2_order_cnt INT DEFAULT 0 COMMENT '支付宝2元以上限制订单数',
  real_consume_fee DECIMAL(12,2) DEFAULT 0.00 COMMENT '实际消费金额',

  -- NFC 交易指标
  nfc_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT 'NFC交易金额',
  nfc_transaction_count INT DEFAULT 0 COMMENT 'NFC交易笔数',
  effective_nfc_transaction_count INT DEFAULT 0 COMMENT '有效NFC交易笔数',
  nfc_amt_2_restrict_2_order_cnt INT DEFAULT 0 COMMENT 'NFC 2元以上限制订单数',
  has_nfc_trade TINYINT(1) DEFAULT 0 COMMENT '是否有NFC交易',
  has_nfc_trade_greater_2 TINYINT(1) DEFAULT 0 COMMENT '是否有2元以上NFC交易',
  nfc_trade_greater_2 TINYINT(1) DEFAULT 0 COMMENT 'NFC 2元以上交易',

  -- 退款指标
  refund_order_amt DECIMAL(12,2) DEFAULT 0.00 COMMENT '退款订单金额',
  refund_order_cnt INT DEFAULT 0 COMMENT '退款订单数',
  real_refund_fee DECIMAL(12,2) DEFAULT 0.00 COMMENT '实际退款金额',

  -- 设备运营指标
  be_register TINYINT(1) DEFAULT 0 COMMENT '是否已注册',
  register_time DATETIME COMMENT '注册时间',
  update_register_time DATETIME COMMENT '更新注册时间',
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

  -- 用户指标
  trd_nfc_device_usercnt VARCHAR(20) DEFAULT '0' COMMENT 'NFC设备用户数',
  trd_amt_2_n_user_cnt_fromlight_30_d VARCHAR(20) DEFAULT '0' COMMENT '点亮30天内消费2元用户数',
  trd_amt_2_user_cnt VARCHAR(20) DEFAULT '0' COMMENT '消费2元以上用户数',
  trd_amt_3_user_cnt VARCHAR(20) DEFAULT '0' COMMENT '消费3元以上用户数',
  trd_greater_2_nfc_device_usercnt VARCHAR(20) DEFAULT '0' COMMENT '2元以上NFC设备用户数',
  nfc_amt_2_user_cnt_last_bind_30_d VARCHAR(20) DEFAULT '0' COMMENT '绑定30天内NFC消费2元用户数',

  -- 其他指标
  leads_worker_id VARCHAR(30) COMMENT '地推人员ID',
  leads_worker_name VARCHAR(50) COMMENT '地推人员姓名',
  leads_location VARCHAR(100) COMMENT '地推位置',
  leads_location_address VARCHAR(200) COMMENT '地推地址',
  leads_poi_id VARCHAR(50) COMMENT '地推POI ID',
  digital_poi_id VARCHAR(50) COMMENT '数字POI ID',
  shipping_time DATETIME COMMENT '发货时间',
  open_id VARCHAR(100) COMMENT '用户open_id',
  micro_command_active_7_day TINYINT(1) DEFAULT 0 COMMENT '7天微指令活跃',
  advance_plan VARCHAR(50) COMMENT '设备获取方式',
  be_change_device TINYINT(1) DEFAULT 0 COMMENT '是否换机',
  change_device_sn VARCHAR(50) COMMENT '换机后SN',
  change_device_time DATETIME COMMENT '换机时间',
  be_high_tpv_shop TINYINT(1) DEFAULT 0 COMMENT '高流量店铺',
  be_special_shop TINYINT(1) DEFAULT 0 COMMENT '特殊店铺',
  be_unified_collect TINYINT(1) DEFAULT 0 COMMENT '统一收银',
  instructions_work_time DATETIME COMMENT '指令工作时间',
  act_instructions_dvc VARCHAR(10) DEFAULT '0' COMMENT '活跃指令设备数',
  be_access_my_tiny_cmd_td TINYINT(1) DEFAULT 0 COMMENT '今日是否访问小程序',
  valid_open_days_last_bind_30_d VARCHAR(10) DEFAULT '0' COMMENT '绑定30天内有效开机天数',
  nfc_amt_2_days_last_bind_30_d VARCHAR(10) DEFAULT '0' COMMENT '绑定30天内NFC消费2元天数',
  sign_days_last_bind_30_d VARCHAR(10) DEFAULT '0' COMMENT '绑定30天内签到天数',
  sign_days_last_bind_7_d VARCHAR(10) DEFAULT '0' COMMENT '绑定7天内签到天数',
  cur_bind_status VARCHAR(20) COMMENT '当前绑定状态',
  poi_first_sign_time DATETIME COMMENT 'POI首次签约时间',
  store_first_sale_1_yuan_date DATETIME COMMENT '门店首笔1元销售日期',

  -- 原始数据存储（完整保留，便于后续扩展）
  raw_data JSON COMMENT '接口原始返回完整数据',

  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '同步时间',

  -- 索引
  KEY idx_tenant_date (tenant_id, metrics_date),
  KEY idx_tenant_sn (tenant_id, sn),
  KEY idx_tenant_store (tenant_id, store_id),
  KEY idx_tenant_province (tenant_id, province_code),
  KEY idx_date_sn (metrics_date, sn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备日维度指标数据表';

-- ============================================================
-- 数据同步日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  metrics_date DATE NOT NULL COMMENT '同步的数据日期',
  status ENUM('pending','running','success','failed','partial') DEFAULT 'pending' COMMENT '同步状态',
  total_records INT DEFAULT 0 COMMENT '总记录数',
  synced_records INT DEFAULT 0 COMMENT '已同步记录数',
  error_message TEXT COMMENT '错误信息',
  started_at DATETIME COMMENT '开始时间',
  finished_at DATETIME COMMENT '完成时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant_date (tenant_id, metrics_date),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据同步日志表';

-- ============================================================
-- 报表导出记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS export_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  user_id INT COMMENT '操作用户ID',
  user_type ENUM('admin','tenant') NOT NULL COMMENT '用户类型',
  export_type ENUM('excel','pdf') NOT NULL COMMENT '导出类型',
  file_name VARCHAR(200) COMMENT '文件名',
  file_path VARCHAR(500) COMMENT '文件存储路径',
  file_size BIGINT DEFAULT 0 COMMENT '文件大小(bytes)',
  status ENUM('pending','generating','success','failed') DEFAULT 'pending' COMMENT '导出状态',
  filter_config JSON COMMENT '筛选条件配置',
  error_message TEXT COMMENT '错误信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id),
  KEY idx_user (user_id, user_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报表导出记录表';
