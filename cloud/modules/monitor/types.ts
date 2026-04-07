/**
 * 监控模块 - 类型定义
 */

export interface MetricPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne';
  threshold: number;
  duration: number;  // 持续时间（秒）
  severity: 'critical' | 'warning' | 'info';
  channels: AlertChannel[];
  enabled: boolean;
}

export interface AlertChannel {
  type: 'dingtalk' | 'wecom' | 'email' | 'webhook';
  config: Record<string, unknown>;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  value: number;
  threshold: number;
  triggeredAt: Date;
  recoveredAt?: Date;
  status: 'firing' | 'resolved';
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    queue: ServiceHealth;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    requestCount: number;
    errorRate: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

export interface SystemMetrics {
  cpu: number;
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  uptime: number;
  nodeVersion: string;
  platform: string;
}
