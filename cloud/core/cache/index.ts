/**
 * Redis 缓存模块
 * 支持：缓存、分布式锁、会话存储
 */
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../logger';

class CacheManager {
  private client: RedisClientType | null = null;
  private isConnected = false;

  /**
   * 初始化连接
   */
  async connect(): Promise<void> {
    if (this.client) return;

    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('REDIS', '重连失败次数过多');
            return new Error('Redis 连接失败');
          }
          // 指数退避
          return Math.min(retries * 100, 3000);
        },
      },
      password: config.redis.password || undefined,
      database: config.redis.db,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('REDIS', '已连接');
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      logger.warn('REDIS', '已断开');
    });

    this.client.on('error', (err) => {
      logger.error('REDIS', `错误: ${err.message}`);
    });

    await this.client.connect();
  }

  /**
   * 确保已连接
   */
  private ensureConnected(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis 未连接');
    }
    return this.client;
  }

  /**
   * 生成带前缀的 key
   */
  private key(key: string): string {
    return `${config.redis.keyPrefix}${key}`;
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    const client = this.ensureConnected();
    const data = await client.get(this.key(key));
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  /**
   * 设置缓存
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const client = this.ensureConnected();
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await client.setEx(this.key(key), ttlSeconds, data);
    } else {
      await client.set(this.key(key), data);
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    const client = this.ensureConnected();
    await client.del(this.key(key));
  }

  /**
   * 批量删除（支持通配符）
   */
  async delPattern(pattern: string): Promise<number> {
    const client = this.ensureConnected();
    const keys = await client.keys(this.key(pattern));
    if (keys.length === 0) return 0;
    await client.del(keys);
    return keys.length;
  }

  /**
   * 检查是否存在
   */
  async exists(key: string): Promise<boolean> {
    const client = this.ensureConnected();
    return (await client.exists(this.key(key))) > 0;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    const client = this.ensureConnected();
    await client.expire(this.key(key), ttlSeconds);
  }

  // ==================== 分布式锁 ====================

  /**
   * 获取分布式锁
   */
  async lock(key: string, ttlSeconds: number = 30): Promise<string | null> {
    const client = this.ensureConnected();
    const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const result = await client.set(this.key(`lock:${key}`), token, {
      NX: true,
      EX: ttlSeconds,
    });
    return result === 'OK' ? token : null;
  }

  /**
   * 释放分布式锁
   */
  async unlock(key: string, token: string): Promise<boolean> {
    const client = this.ensureConnected();
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await client.eval(script, {
      keys: [this.key(`lock:${key}`)],
      arguments: [token],
    });
    return result === 1;
  }

  /**
   * 续期锁
   */
  async renewLock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    const client = this.ensureConnected();
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await client.eval(script, {
      keys: [this.key(`lock:${key}`)],
      arguments: [token, String(ttlSeconds)],
    });
    return result === 1;
  }

  // ==================== 计数器 ====================

  /**
   * 自增
   */
  async incr(key: string): Promise<number> {
    const client = this.ensureConnected();
    return client.incr(this.key(key));
  }

  /**
   * 自减
   */
  async decr(key: string): Promise<number> {
    const client = this.ensureConnected();
    return client.decr(this.key(key));
  }

  // ==================== 健康检查 ====================

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.ensureConnected();
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('REDIS', '连接已关闭');
    }
  }
}

export const cache = new CacheManager();
export default cache;
