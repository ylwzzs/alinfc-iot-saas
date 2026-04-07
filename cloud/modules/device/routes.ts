/**
 * 设备模块 - 路由
 */
import Router from '@koa/router';
import { authMiddleware, adminGuard, tenantGuard } from '../../core/middleware';
import { deviceService } from './service';

// ==================== 租户端路由 ====================

const tenantRouter = new Router({ prefix: '/api/tenant' });

/**
 * 获取 Dashboard 数据
 */
tenantRouter.get('/dashboard', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { days } = ctx.query;

  const data = await deviceService.getDashboard(tenantId, days ? parseInt(days as string) : 30);
  ctx.body = { success: true, data };
});

/**
 * 获取设备列表
 */
tenantRouter.get('/devices', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { startDate, endDate, sn, storeId, provinceCode, cityCode, page, pageSize } = ctx.query;

  const result = await deviceService.getDeviceList(tenantId, {
    startDate: startDate as string,
    endDate: endDate as string,
    sn: sn as string,
    storeId: storeId as string,
    provinceCode: provinceCode as string,
    cityCode: cityCode as string,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 20,
  });

  ctx.body = { success: true, data: result };
});

/**
 * 获取数据分析
 */
tenantRouter.get('/analytics', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { startDate, endDate, type } = ctx.query;

  const start = (startDate as string) || getDateRange(30).startDate;
  const end = (endDate as string) || getDateRange(30).endDate;

  let data;
  switch (type) {
    case 'daily':
      data = await deviceService.getDailySummary(tenantId, start, end);
      break;
    case 'store':
      data = await deviceService.getStoreRanking(tenantId, start, end);
      break;
    case 'province':
      data = await deviceService.getProvinceStats(tenantId, start, end);
      break;
    default:
      data = await deviceService.getDailySummary(tenantId, start, end);
  }

  ctx.body = { success: true, data };
});

/**
 * 获取设备数量
 */
tenantRouter.get('/device-count', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const count = await deviceService.getDeviceCount(tenantId);
  ctx.body = { success: true, data: { count } };
});

// ==================== 管理员路由 ====================

const adminRouter = new Router({ prefix: '/api/admin' });

/**
 * 获取全局概览
 */
adminRouter.get('/overview', authMiddleware(), adminGuard(), async (ctx) => {
  const { days } = ctx.query;
  const data = await deviceService.getGlobalOverview(days ? parseInt(days as string) : 30);
  ctx.body = { success: true, data };
});

// ==================== 辅助函数 ====================

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export { tenantRouter as tenantDeviceRoutes, adminRouter as adminDeviceRoutes };
