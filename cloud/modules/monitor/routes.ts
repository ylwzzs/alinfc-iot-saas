/**
 * 监控模块 - 路由
 */
import Router from '@koa/router';
import { monitorService } from './service';

const router = new Router({ prefix: '/api/monitor' });

/**
 * 健康检查（公开）
 */
router.get('/health', async (ctx) => {
  const health = await monitorService.getHealthStatus();

  // 根据状态设置 HTTP 状态码
  if (health.status === 'unhealthy') {
    ctx.status = 503;
  } else if (health.status === 'degraded') {
    ctx.status = 200; // 仍返回 200，但标记为降级
  }

  ctx.body = health;
});

/**
 * 系统指标（需认证）
 */
router.get('/metrics', async (ctx) => {
  const metrics = monitorService.getSystemMetrics();
  ctx.body = {
    success: true,
    data: metrics,
  };
});

/**
 * 详细健康状态（需认证）
 */
router.get('/status', async (ctx) => {
  const health = await monitorService.getHealthStatus();
  ctx.body = {
    success: true,
    data: health,
  };
});

/**
 * 指标历史
 */
router.get('/metrics/:name', async (ctx) => {
  const name = ctx.params.name;
  const duration = ctx.query.duration ? parseInt(ctx.query.duration as string) : 3600000;

  const history = await monitorService.getMetricHistory(name, duration);
  ctx.body = {
    success: true,
    data: history,
  };
});

// 无需认证的 k8s 探针接口
router.get('/ready', async (ctx) => {
  const health = await monitorService.getHealthStatus();
  if (health.status === 'unhealthy') {
    ctx.status = 503;
    ctx.body = 'Not Ready';
  } else {
    ctx.status = 200;
    ctx.body = 'Ready';
  }
});

router.get('/live', async (ctx) => {
  ctx.status = 200;
  ctx.body = 'Alive';
});

export { router as monitorRoutes };
