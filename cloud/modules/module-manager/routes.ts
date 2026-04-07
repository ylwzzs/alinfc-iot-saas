/**
 * 模块管理 - 路由
 */
import Router from '@koa/router';
import { authMiddleware, adminGuard, tenantGuard } from '../../core/middleware';
import { moduleService } from './service';
import { moduleRepository } from './repository';

const router = new Router({ prefix: '/api/admin/modules' });

/**
 * 获取所有系统模块
 */
router.get('/', authMiddleware(), adminGuard(), async (ctx) => {
  const modules = await moduleService.getSystemModules();
  ctx.body = { success: true, data: modules };
});

/**
 * 获取租户的模块配置
 */
router.get('/tenant/:tenantId', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const modules = await moduleService.getTenantModules(tenantId);
  ctx.body = { success: true, data: modules };
});

/**
 * 为租户启用模块
 */
router.post('/tenant/:tenantId/enable', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const { moduleId, config, expiresAt } = ctx.request.body as {
    moduleId: string;
    config?: Record<string, unknown>;
    expiresAt?: string;
  };

  try {
    await moduleService.enableModule(
      tenantId,
      moduleId,
      config,
      expiresAt ? new Date(expiresAt) : undefined
    );
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

/**
 * 为租户禁用模块
 */
router.post('/tenant/:tenantId/disable', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const { moduleId } = ctx.request.body as { moduleId: string };

  try {
    await moduleService.disableModule(tenantId, moduleId);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

/**
 * 批量设置租户模块
 */
router.post('/tenant/:tenantId/batch', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const { modules } = ctx.request.body as {
    modules: { moduleId: string; enabled: boolean; config?: Record<string, unknown> }[];
  };

  try {
    await moduleService.setTenantModules(tenantId, modules);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

// ==================== 租户端路由 ====================

const tenantRouter = new Router({ prefix: '/api/tenant/modules' });

/**
 * 获取当前租户可用模块
 */
tenantRouter.get('/', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const modules = await moduleService.getTenantModules(tenantId);
  ctx.body = { success: true, data: modules };
});

export { router as adminModuleRoutes, tenantRouter as tenantModuleRoutes };
