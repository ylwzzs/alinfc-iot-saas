/**
 * 监控模块 - 业务逻辑层
 */
import os from 'os';
import { cache } from '../../core/cache';
import { db } from '../../core/database';
import { logger } from '../../core/logger';
import type { AlertRule, AlertEvent, AlertChannel, HealthStatus, SystemMetrics, ServiceHealth } from './types';

export class MonitorService {
  private readonly METRIC_PREFIX = 'monitor:';
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  /**
   * 记录请求
   */
  recordRequest(error = false): void {
    this.requestCount++;
    if (error) this.errorCount++;
  }

  /**
   * 获取系统指标
   */
  getSystemMetrics(): SystemMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpu: process.cpuUsage().user / 1000000, // 转换为秒
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: (usedMemory / totalMemory) * 100,
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: `${os.type()} ${os.release()}`,
    };
  }

  /**
   * 获取健康状态
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const queueHealth = await this.checkQueue();

    // 判断整体状态
    const services = [dbHealth, redisHealth, queueHealth];
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount === 0) {
      status = 'healthy';
    } else if (unhealthyCount < services.length) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const errorRate = this.requestCount > 0
      ? (this.errorCount / this.requestCount) * 100
      : 0;

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        redis: redisHealth,
        queue: queueHealth,
      },
      metrics: {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user,
        requestCount: this.requestCount,
        errorRate,
      },
    };
  }

  /**
   * 检查数据库
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await db.healthCheck();
      return {
        status: 'healthy',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: (error as Error).message,
      };
    }
  }

  /**
   * 检查 Redis
   */
  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const healthy = await cache.healthCheck();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: (error as Error).message,
      };
    }
  }

  /**
   * 检查队列
   */
  private async checkQueue(): Promise<ServiceHealth> {
    try {
      const stats = await cache.get<{ pending: number }>('queue:stats');
      return {
        status: 'healthy',
        message: stats ? `Pending: ${stats.pending}` : 'Queue ready',
      };
    } catch {
      return {
        status: 'healthy',
        message: 'Queue initialized',
      };
    }
  }

  // ==================== 告警相关 ====================

  /**
   * 发送告警
   */
  async sendAlert(rule: AlertRule, value: number): Promise<void> {
    const event: AlertEvent = {
      id: `alert-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} = ${value}, 阈值 ${rule.operator} ${rule.threshold}`,
      value,
      threshold: rule.threshold,
      triggeredAt: new Date(),
      status: 'firing',
    };

    logger.warn('ALERT', `告警触发: ${event.message}`, { event });

    // 发送到各渠道
    for (const channel of rule.channels) {
      try {
        await this.sendToChannel(channel, event);
      } catch (error) {
        logger.error('ALERT', `发送告警失败`, { channel: channel.type, error: (error as Error).message });
      }
    }
  }

  /**
   * 发送到告警渠道
   */
  private async sendToChannel(channel: AlertChannel, event: AlertEvent): Promise<void> {
    switch (channel.type) {
      case 'dingtalk':
        await this.sendDingTalk(channel.config.webhook as string, event);
        break;
      case 'wecom':
        await this.sendWeCom(channel.config.webhook as string, event);
        break;
      case 'webhook':
        await this.sendWebhook(channel.config.url as string, event);
        break;
      default:
        logger.warn('ALERT', `不支持的告警渠道: ${channel.type}`);
    }
  }

  /**
   * 发送钉钉告警
   */
  private async sendDingTalk(webhook: string, event: AlertEvent): Promise<void> {
    const body = {
      msgtype: 'markdown',
      markdown: {
        title: `【${event.severity.toUpperCase()}】${event.ruleName}`,
        text: `### 【${event.severity.toUpperCase()}】${event.ruleName}\n\n` +
          `- **告警内容**: ${event.message}\n` +
          `- **触发时间**: ${event.triggeredAt.toISOString()}\n` +
          `- **当前值**: ${event.value}\n` +
          `- **阈值**: ${event.threshold}\n`,
      },
    };

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`钉钉告警发送失败: ${response.status}`);
    }
  }

  /**
   * 发送企业微信告警
   */
  private async sendWeCom(webhook: string, event: AlertEvent): Promise<void> {
    const body = {
      msgtype: 'markdown',
      markdown: {
        content: `### 【${event.severity.toUpperCase()}】${event.ruleName}\n` +
          `> 告警内容: ${event.message}\n` +
          `> 触发时间: ${event.triggeredAt.toISOString()}\n` +
          `> 当前值: ${event.value}\n` +
          `> 阈值: ${event.threshold}`,
      },
    };

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`企微告警发送失败: ${response.status}`);
    }
  }

  /**
   * 发送 Webhook 告警
   */
  private async sendWebhook(url: string, event: AlertEvent): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Webhook 告警发送失败: ${response.status}`);
    }
  }

  // ==================== 指标记录 ====================

  /**
   * 记录指标
   */
  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    const key = `${this.METRIC_PREFIX}${name}`;
    const now = Date.now();

    // 使用 Redis 有序集合存储时序数据
    const client = (cache as any).client;
    await client.zAdd(key, [{ score: now, value: JSON.stringify({ value, tags }) }]);

    // 只保留最近 1 小时的数据
    const oneHourAgo = now - 3600000;
    await client.zRemRangeByScore(key, 0, oneHourAgo);
  }

  /**
   * 获取指标历史
   */
  async getMetricHistory(name: string, duration = 3600000): Promise<{ timestamp: number; value: number }[]> {
    const key = `${this.METRIC_PREFIX}${name}`;
    const now = Date.now();
    const start = now - duration;

    const client = (cache as any).client;
    const data = await client.zRangeByScore(key, start, now);

    return data.map((item: string) => {
      const parsed = JSON.parse(item);
      return { timestamp: parsed.timestamp, value: parsed.value };
    });
  }
}

export const monitorService = new MonitorService();
