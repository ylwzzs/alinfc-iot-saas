/**
 * 同步模块 - 路由
 */
import Router from '@koa/router';
import { authMiddleware, adminGuard, tenantGuard } from '../../core/middleware';
import { syncService } from './service';

// ==================== 管理员路由 ====================

const adminRouter = new Router({ prefix: '/api/admin/sync' });

/**
 * 获取同步日志
 */
adminRouter.get('/logs', authMiddleware(), adminGuard(), async (ctx) => {
  const { limit } = ctx.query;
  const logs = await syncService.getRecentSyncLogs(limit ? parseInt(limit as string) : 50);
  ctx.body = { success: true, data: logs };
});

/**
 * 触发单个租户同步
 */
adminRouter.post('/tenant/:tenantId', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const { metricsDate } = ctx.request.body as { metricsDate?: string };

  // 默认同步昨天
  const date = metricsDate || getYesterday();

  try {
    const taskId = await syncService.addSyncTask(tenantId, date);
    ctx.body = { success: true, data: { taskId, metricsDate: date } };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

/**
 * 触发所有租户同步
 */
adminRouter.post('/all', authMiddleware(), adminGuard(), async (ctx) => {
  const { metricsDate } = ctx.request.body as { metricsDate?: string };

  const date = metricsDate || getYesterday();

  try {
    const count = await syncService.addSyncTasksForAllTenants(date);
    ctx.body = { success: true, data: { count, metricsDate: date } };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

/**
 * 获取同步进度
 */
adminRouter.get('/progress/:tenantId/:metricsDate', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const metricsDate = ctx.params.metricsDate;

  const progress = await syncService.getProgress(tenantId, metricsDate);
  ctx.body = { success: true, data: progress };
});

/**
 * 重试失败的同步
 */
adminRouter.post('/retry/:tenantId/:metricsDate', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const metricsDate = ctx.params.metricsDate;

  try {
    const taskId = await syncService.retryFailed(tenantId, metricsDate);
    ctx.body = { success: true, data: { taskId } };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

// ==================== 租户端路由 ====================

const tenantRouter = new Router({ prefix: '/api/tenant/sync' });

/**
 * 获取同步日志
 */
tenantRouter.get('/logs', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const logs = await syncService.getSyncLogs(tenantId);
  ctx.body = { success: true, data: logs };
});

/**
 * 获取同步进度
 */
tenantRouter.get('/progress/:metricsDate', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const metricsDate = ctx.params.metricsDate;

  const progress = await syncService.getProgress(tenantId, metricsDate);
  ctx.body = { success: true, data: progress };
});

// ==================== 辅助函数 ====================

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export { adminRouter as adminSyncRoutes, tenantRouter as tenantSyncRoutes };
