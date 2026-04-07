/**
 * 统一配置管理
 */
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务配置
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alinfc',
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || '20', 10),
    timezone: '+08:00',
  },

  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: 'alinfc:',
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 支付宝配置
  alipay: {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    redirectUri: process.env.ALIPAY_REDIRECT_URI || '',
  },

  // 加密配置
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },

  // 前端地址
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  // 同步配置
  sync: {
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '1000', 10),
    concurrency: parseInt(process.env.SYNC_CONCURRENCY || '3', 10),
    retryTimes: parseInt(process.env.SYNC_RETRY_TIMES || '3', 10),
    delayMs: parseInt(process.env.SYNC_DELAY_MS || '200', 10),
  },
};

export type Config = typeof config;
