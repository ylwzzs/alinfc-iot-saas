-- alinfc 数据库初始化脚本

-- 管理员表
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `real_name` varchar(50) DEFAULT NULL,
  `status` tinyint DEFAULT 1 COMMENT '1:启用 0:禁用',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 租户表
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `app_id` varchar(100) DEFAULT NULL COMMENT '支付宝应用AppId',
  `app_auth_token` varchar(255) DEFAULT NULL COMMENT '授权Token',
  `contact_name` varchar(50) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `status` tinyint DEFAULT 1 COMMENT '1:启用 0:禁用',
  `authorization_status` varchar(20) DEFAULT 'pending' COMMENT 'pending/authorizing/authorized/expired',
  `authorization_expires` datetime DEFAULT NULL COMMENT '授权过期时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 设备表
CREATE TABLE IF NOT EXISTS `devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `device_id` varchar(100) NOT NULL COMMENT '设备唯一标识',
  `device_name` varchar(100) DEFAULT NULL,
  `device_type` varchar(50) DEFAULT NULL COMMENT '设备类型',
  `location` varchar(200) DEFAULT NULL COMMENT '安装位置',
  `status` tinyint DEFAULT 1 COMMENT '1:在线 0:离线',
  `last_heartbeat` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_device` (`tenant_id`, `device_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 设备数据表
CREATE TABLE IF NOT EXISTS `device_data` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `device_id` varchar(100) NOT NULL,
  `data_type` varchar(50) NOT NULL COMMENT '数据类型',
  `value` decimal(10,2) NOT NULL COMMENT '数据值',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `recorded_at` datetime NOT NULL COMMENT '记录时间',
  `synced_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_device_time` (`device_id`, `recorded_at`),
  KEY `idx_tenant_time` (`tenant_id`, `recorded_at`),
  KEY `idx_recorded_at` (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据同步记录表
CREATE TABLE IF NOT EXISTS `sync_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `sync_type` varchar(20) NOT NULL COMMENT 'device/data/all',
  `status` varchar(20) NOT NULL COMMENT 'running/success/failed',
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `records_count` int DEFAULT 0,
  `error_message` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化管理员账号 (admin / admin123)
INSERT INTO `admin_users` (`username`, `password`) VALUES 
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye7LpVr3h1H0K8L/jE2P5T5oYjXjJqZKy')
ON DUPLICATE KEY UPDATE username = username;
