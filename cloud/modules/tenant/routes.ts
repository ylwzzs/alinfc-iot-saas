/**
 * 租户模块 - 路由
 */
import Router from '@koa/router';
import { authMiddleware, adminGuard, tenantGuard, CtxState } from '../../core/middleware';
import { tenantService } from './service';
import type { TenantCreateInput, TenantUpdateInput } from './types';

const router = new Router({ prefix: '/api/admin/tenants' });

/**
 * 获取租户列表
 */
router.get('/', authMiddleware(), adminGuard(), async (ctx) => {
  const { page, pageSize, keyword, status, authStatus } = ctx.query;

  const result = await tenantService.getList({
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 20,
    keyword: keyword as string,
    status: status ? parseInt(status as string) as 0 | 1 : undefined,
    authStatus: authStatus as any,
  });

  ctx.body = { success: true, data: result };
});

/**
 * 创建租户
 */
router.post('/', authMiddleware(), adminGuard(), async (ctx) => {
  const { name, contact_name, contact_phone } = ctx.request.body as TenantCreateInput;

  if (!name) {
    ctx.status = 400;
    ctx.body = { success: false, message: '租户名称不能为空' };
    return;
  }

  try {
    const id = await tenantService.create({ name, contact_name, contact_phone });
    ctx.body = { success: true, data: { id } };
  } catch (error) {
    ctx.status = 409;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

/**
 * 更新租户
 */
router.put('/:id', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const { name, contact_name, contact_phone } = ctx.request.body as TenantUpdateInput;

  try {
    await tenantService.update(id, { name, contact_name, contact_phone });
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 409;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

/**
 * 更新租户状态
 */
router.put('/:id/status', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const { status } = ctx.request.body as { status: number };

  await tenantService.updateStatus(id, status);
  ctx.body = { success: true };
});

/**
 * 删除租户
 */
router.delete('/:id', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);

  try {
    await tenantService.delete(id);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { success: false, message: (error as Error).message };
  }
});

/**
 * 获取单个租户信息
 */
router.get('/:id', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const tenant = await tenantService.getById(id);

  if (!tenant) {
    ctx.status = 404;
    ctx.body = { success: false, message: '租户不存在' };
    return;
  }

  // 隐藏敏感信息
  const { app_auth_token, refresh_token, ...safeTenant } = tenant as any;
  ctx.body = { success: true, data: safeTenant };
});

// ==================== 租户端路由 ====================

const tenantRouter = new Router({ prefix: '/api/tenant' });

/**
 * 获取当前租户信息
 */
tenantRouter.get('/info', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const tenant = await tenantService.getById(tenantId);

  if (!tenant) {
    ctx.status = 404;
    ctx.body = { success: false, message: '租户不存在' };
    return;
  }

  // 隐藏敏感信息
  const { app_auth_token, refresh_token, ...safeTenant } = tenant as any;
  ctx.body = { success: true, data: safeTenant };
});

/**
 * 更新当前租户信息
 */
tenantRouter.put('/info', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { contact_name, contact_phone } = ctx.request.body as TenantUpdateInput;

  await tenantService.update(tenantId, { contact_name, contact_phone });
  ctx.body = { success: true };
});

export { router as adminTenantRoutes, tenantRouter as tenantInfoRoutes };
