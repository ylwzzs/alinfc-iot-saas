/**
 * 告警规则配置
 */
import type { AlertRule } from './types';

// 预置告警规则
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'sync-failed',
    name: '数据同步失败',
    description: '数据同步任务连续失败',
    metric: 'sync.failed_count',
    operator: 'gt',
    threshold: 3,
    duration: 300,
    severity: 'critical',
    channels: [
      { type: 'dingtalk', config: { webhook: process.env.DINGTALK_WEBHOOK || '' } },
    ],
    enabled: true,
  },
  {
    id: 'api-error-rate',
    name: 'API 错误率过高',
    description: 'API 错误率超过阈值',
    metric: 'api.error_rate',
    operator: 'gt',
    threshold: 5, // 5%
    duration: 60,
    severity: 'warning',
    channels: [
      { type: 'wecom', config: { webhook: process.env.WECOM_WEBHOOK || '' } },
    ],
    enabled: true,
  },
  {
    id: 'api-latency',
    name: 'API 响应慢',
    description: 'API 平均响应时间过长',
    metric: 'api.latency_p99',
    operator: 'gt',
    threshold: 3000, // 3秒
    duration: 60,
    severity: 'warning',
    channels: [
      { type: 'dingtalk', config: { webhook: process.env.DINGTALK_WEBHOOK || '' } },
    ],
    enabled: true,
  },
  {
    id: 'db-connection',
    name: '数据库连接异常',
    description: '数据库连接数过高',
    metric: 'db.connections',
    operator: 'gt',
    threshold: 80, // 80%
    duration: 60,
    severity: 'warning',
    channels: [
      { type: 'wecom', config: { webhook: process.env.WECOM_WEBHOOK || '' } },
    ],
    enabled: true,
  },
  {
    id: 'memory-usage',
    name: '内存使用过高',
    description: '内存使用率超过阈值',
    metric: 'system.memory_usage',
    operator: 'gt',
    threshold: 80, // 80%
    duration: 120,
    severity: 'warning',
    channels: [
      { type: 'dingtalk', config: { webhook: process.env.DINGTALK_WEBHOOK || '' } },
    ],
    enabled: true,
  },
  {
    id: 'disk-usage',
    name: '磁盘空间不足',
    description: '磁盘使用率过高',
    metric: 'system.disk_usage',
    operator: 'gt',
    threshold: 80, // 80%
    duration: 300,
    severity: 'warning',
    channels: [
      { type: 'wecom', config: { webhook: process.env.WECOM_WEBHOOK || '' } },
    ],
    enabled: true,
  },
];

/**
 * 告警规则管理
 */
class AlertRuleManager {
  private rules: Map<string, AlertRule> = new Map();

  constructor() {
    // 加载默认规则
    DEFAULT_ALERT_RULES.forEach(rule => {
      if (rule.enabled) {
        this.rules.set(rule.id, rule);
      }
    });
  }

  /**
   * 获取所有规则
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取规则
   */
  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  /**
   * 添加规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * 删除规则
   */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * 更新规则
   */
  updateRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }
}

export const alertRuleManager = new AlertRuleManager();
