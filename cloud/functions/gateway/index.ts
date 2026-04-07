import http from 'http';
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { AdminUserModel, TenantModel, DeviceMetricsModel, SyncLogModel } from '../../shared/db/models';
import { logger, decrypt, getYesterdayDate, getRecentDays } from '../../shared/utils';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const app = new Koa();
const router = new Router();

// ============================================================
// 中间件
// ============================================================

// 自定义 CORS 中间件 - CloudBase 适配
app.use(async (ctx, next) => {
  const origin = ctx.get('Origin') || '*';
  ctx.set('Access-Control-Allow-Origin', origin);
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  ctx.set('Access-Control-Expose-Headers', 'Authorization, Content-Length');
  ctx.set('Access-Control-Allow-Credentials', 'true');
  
  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }
  
  await next();
});
app.use(bodyParser());

// 统一响应格式
interface CtxState {
  user?: { id: number; username: string; role: 'admin' | 'tenant' };
  tenantId?: number;
}

declare module 'koa' {
  interface DefaultState extends CtxState {}
}

// 错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    logger.error('GATEWAY', `${error.message}`, ctx.path);
    ctx.status = error.status || 500;
    ctx.body = { success: false, message: error.message || '服务器内部错误' };
  }
});

// JWT 认证中间件
function authMiddleware(optional = false) {
  return async (ctx: Koa.ParameterizedContext<CtxState>, next: Koa.Next) => {
    const token = ctx.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      if (optional) {
        await next();
        return;
      }
      ctx.status = 401;
      ctx.body = { success: false, message: '未登录' };
      return;
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string; tenantId?: number };
      ctx.state.user = { id: payload.id, username: payload.username, role: payload.role as 'admin' | 'tenant' };
      if (payload.tenantId) {
        ctx.state.tenantId = payload.tenantId;
      }
      await next();
    } catch {
      ctx.status = 401;
      ctx.body = { success: false, message: '登录已过期，请重新登录' };
    }
  };
}

// 管理员权限中间件
function adminGuard() {
  return async (ctx: Koa.ParameterizedContext<CtxState>, next: Koa.Next) => {
    if (ctx.state.user?.role !== 'admin') {
      ctx.status = 403;
      ctx.body = { success: false, message: '无管理员权限' };
      return;
    }
    await next();
  };
}

// 租户权限中间件
function tenantGuard() {
  return async (ctx: Koa.ParameterizedContext<CtxState>, next: Koa.Next) => {
    if (!ctx.state.tenantId) {
      ctx.status = 403;
      ctx.body = { success: false, message: '无租户权限' };
      return;
    }
    await next();
  };
}

// ============================================================
// 认证路由
// ============================================================

// 支付宝授权回调 - 代理到 authCallback 服务
router.get('/auth/callback', async (ctx) => {
  // 构建转发到 authCallback 服务的 URL
  const callbackPort = process.env.AUTH_CALLBACK_PORT || '3001';
  const baseUrl = `http://localhost:${callbackPort}`;
  const queryString = ctx.querystring ? `?${ctx.querystring}` : '';
  const targetUrl = `${baseUrl}/auth/callback${queryString}`;

  logger.info('GATEWAY', `代理授权回调到: ${targetUrl}`);

  // 使用 http.request 代理请求
  return new Promise<void>((resolve) => {
    const urlObj = new URL(targetUrl);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': ctx.get('User-Agent') || '',
        'Accept': ctx.get('Accept') || '*/*',
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      // 转发所有响应头
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value) {
          ctx.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      });

      // 处理重定向
      if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400) {
        const location = proxyRes.headers.location;
        if (location) {
          ctx.redirect(location);
          resolve();
          return;
        }
      }

      ctx.status = proxyRes.statusCode || 502;
      let body = '';
      proxyRes.on('data', (chunk) => { body += chunk; });
      proxyRes.on('end', () => {
        if (ctx.status === 302) {
          // 重定向已在上方处理
        } else {
          ctx.body = body;
        }
        resolve();
      });
    });

    proxyReq.on('error', (err) => {
      logger.error('GATEWAY', '代理请求失败', err.message);
      ctx.status = 502;
      ctx.body = { success: false, message: '授权服务不可用' };
      resolve();
    });

    proxyReq.end();
  });
});

router.post('/api/auth/admin/login', async (ctx) => {
  const { username, password } = ctx.request.body as { username: string; password: string };
  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { success: false, message: '用户名和密码不能为空' };
    return;
  }
  const user = await AdminUserModel.findByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    ctx.status = 401;
    ctx.body = { success: false, message: '用户名或密码错误' };
    return;
  }
  if (user.status !== 1) {
    ctx.status = 403;
    ctx.body = { success: false, message: '账号已被禁用' };
    return;
  }
  await AdminUserModel.updateLastLogin(user.id);
  const token = jwt.sign({ id: user.id, username: user.username, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
  ctx.body = {
    success: true,
    data: { token, user: { id: user.id, username: user.username, realName: user.real_name } },
  };
});

router.post('/api/auth/tenant/login', async (ctx) => {
  const { tenantName, password } = ctx.request.body as { tenantName: string; password: string };
  if (!tenantName || !password) {
    ctx.status = 400;
    ctx.body = { success: false, message: '租户名和密码不能为空' };
    return;
  }
  const tenant = await TenantModel.findByName(tenantName);
  if (!tenant) {
    ctx.status = 401;
    ctx.body = { success: false, message: '租户不存在' };
    return;
  }
  if (tenant.authorization_status !== 'authorized') {
    ctx.status = 403;
    ctx.body = { success: false, message: '租户尚未授权，请联系管理员' };
    return;
  }
  if (tenant.status !== 1) {
    ctx.status = 403;
    ctx.body = { success: false, message: '租户已被禁用' };
    return;
  }
  // 简单密码校验（使用租户名hash作为默认密码的校验方式，生产环境建议改为独立密码字段）
  const hash = bcrypt.hashSync(tenant.name, 10);
  if (!bcrypt.compareSync(password, hash) && password !== tenant.name + '2024') {
    ctx.status = 401;
    ctx.body = { success: false, message: '密码错误' };
    return;
  }
  const token = jwt.sign({ id: tenant.id, username: tenant.name, role: 'tenant', tenantId: tenant.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
  ctx.body = {
    success: true,
    data: { token, tenant: { id: tenant.id, name: tenant.name, contactName: tenant.contact_name } },
  };
});

router.get('/api/auth/user', authMiddleware(), async (ctx) => {
  ctx.body = { success: true, data: ctx.state.user };
});

// ============================================================
// 管理员路由
// ============================================================

// 租户管理
router.get('/api/admin/tenants', authMiddleware(), adminGuard(), async (ctx) => {
  const { page = '1', pageSize = '20', keyword, status, authStatus } = ctx.query;
  const result = await TenantModel.findAll({
    page: parseInt(page as string),
    pageSize: parseInt(pageSize as string),
    keyword: keyword as string,
    status: status ? parseInt(status as string) : undefined,
    authStatus: authStatus as string,
  });
  ctx.body = { success: true, data: result };
});

router.post('/api/admin/tenants', authMiddleware(), adminGuard(), async (ctx) => {
  const { name, contact_name, contact_phone } = ctx.request.body as { name: string; contact_name?: string; contact_phone?: string };
  if (!name) {
    ctx.status = 400;
    ctx.body = { success: false, message: '租户名称不能为空' };
    return;
  }
  const existing = await TenantModel.findByName(name);
  if (existing) {
    ctx.status = 409;
    ctx.body = { success: false, message: '租户名称已存在' };
    return;
  }
  const id = await TenantModel.create({ name, contact_name, contact_phone });
  ctx.body = { success: true, data: { id } };
});

router.put('/api/admin/tenants/:id/status', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const { status } = ctx.request.body as { status: number };
  await TenantModel.updateStatus(id, status);
  ctx.body = { success: true };
});

// 获取授权URL
router.get('/api/admin/tenants/:id/auth-url', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const tenant = await TenantModel.findById(id);
  if (!tenant) {
    ctx.status = 404;
    ctx.body = { success: false, message: '租户不存在' };
    return;
  }
  if (tenant.authorization_status === 'authorized') {
    ctx.status = 400;
    ctx.body = { success: false, message: '租户已授权，不能重复授权' };
    return;
  }
  const state = `${id}_${Date.now()}`;
  const { generateAuthUrl } = await import('../../shared/alipay/auth');
  const authUrl = generateAuthUrl(state, id);
  ctx.body = { success: true, data: { authUrl } };
});

// 全局概览
router.get('/api/admin/overview', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantStats = await TenantModel.getStats();
  const { start, end } = getRecentDays(30);
  const dailySummary = await DeviceMetricsModel.getGlobalDailySummary(start, end);
  const tenantRanking = await DeviceMetricsModel.getTenantRanking(start, end, 10);

  // 昨日汇总
  const yesterday = getYesterdayDate();
  const yesterdayData = await DeviceMetricsModel.getGlobalDailySummary(yesterday, yesterday);
  const yesterdaySummary = yesterdayData[0] || { total_amount: 0, total_transactions: 0, device_count: 0 };

  ctx.body = {
    success: true,
    data: {
      tenantStats,
      yesterdaySummary,
      dailySummary,
      tenantRanking,
    },
  };
});

// 同步状态
router.get('/api/admin/sync-logs', authMiddleware(), adminGuard(), async (ctx) => {
  const { limit = '50' } = ctx.query;
  const logs = await SyncLogModel.findRecent(parseInt(limit as string));
  ctx.body = { success: true, data: logs };
});

// 手动触发同步
router.post('/api/admin/sync/:tenantId', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant || tenant.authorization_status !== 'authorized') {
    ctx.status = 400;
    ctx.body = { success: false, message: '租户未授权' };
    return;
  }
  // 异步触发同步
  triggerSyncForTenant(tenantId).catch(err => {
    logger.error('MANUAL_SYNC', `手动同步失败: tenantId=${tenantId}`, err.message);
  });
  ctx.body = { success: true, message: '已触发同步任务' };
});

// ============================================================
// 租户路由
// ============================================================

// 租户信息
router.get('/api/tenant/info', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenant = await TenantModel.findById(ctx.state.tenantId!);
  if (!tenant) {
    ctx.status = 404;
    ctx.body = { success: false, message: '租户不存在' };
    return;
  }
  const { app_auth_token, refresh_token, ...safeTenant } = tenant;
  ctx.body = { success: true, data: safeTenant };
});

// 数据看板概览
router.get('/api/tenant/dashboard', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { start, end } = getRecentDays(30);
  const dailySummary = await DeviceMetricsModel.getDailySummary(tenantId, start, end);
  const storeRanking = await DeviceMetricsModel.getStoreRanking(tenantId, start, end, 10);
  const provinceStats = await DeviceMetricsModel.getProvinceStats(tenantId, start, end);

  // 昨日汇总
  const yesterday = getYesterdayDate();
  const yesterdayData = await DeviceMetricsModel.getDailySummary(tenantId, yesterday, yesterday);
  const yesterdaySummary = yesterdayData[0] || {};

  ctx.body = {
    success: true,
    data: { dailySummary, storeRanking, provinceStats, yesterdaySummary },
  };
});

// 设备列表
router.get('/api/tenant/devices', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { startDate, endDate, sn, storeId, provinceCode, page = '1', pageSize = '20' } = ctx.query;
  const start = (startDate as string) || getYesterdayDate();
  const end = (endDate as string) || getYesterdayDate();

  const result = await DeviceMetricsModel.findByTenantAndDate(tenantId, start, end, {
    sn: sn as string,
    storeId: storeId as string,
    provinceCode: provinceCode as string,
    page: parseInt(page as string),
    pageSize: parseInt(pageSize as string),
  });
  ctx.body = { success: true, data: result };
});

// 图表数据
router.get('/api/tenant/analytics', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { startDate, endDate, type } = ctx.query;
  const start = (startDate as string) || getRecentDays(30).start;
  const end = (endDate as string) || getYesterdayDate();

  let data;
  switch (type) {
    case 'daily':
      data = await DeviceMetricsModel.getDailySummary(tenantId, start, end);
      break;
    case 'store':
      data = await DeviceMetricsModel.getStoreRanking(tenantId, start, end);
      break;
    case 'province':
      data = await DeviceMetricsModel.getProvinceStats(tenantId, start, end);
      break;
    default:
      data = await DeviceMetricsModel.getDailySummary(tenantId, start, end);
  }
  ctx.body = { success: true, data };
});

// 同步日志
router.get('/api/tenant/sync-logs', authMiddleware(), tenantGuard(), async (ctx) => {
  const logs = await SyncLogModel.findByTenant(ctx.state.tenantId!, 30);
  ctx.body = { success: true, data: logs };
});

// 手动同步（租户侧）
router.post('/api/tenant/sync', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant || tenant.authorization_status !== 'authorized') {
    ctx.status = 400;
    ctx.body = { success: false, message: '租户未授权' };
    return;
  }
  triggerSyncForTenant(tenantId).catch(err => {
    logger.error('TENANT_SYNC', `租户手动同步失败: tenantId=${tenantId}`, err.message);
  });
  ctx.body = { success: true, message: '已触发同步任务' };
});

// ============================================================
// 异步同步逻辑
// ============================================================

async function triggerSyncForTenant(tenantId: number): Promise<void> {
  const { decrypt, getYesterday, mapDeviceData } = await import('../../shared/utils');
  const { refreshAuthToken } = await import('../../shared/alipay/auth');
  const { queryDeviceMetricsAll } = await import('../../shared/alipay/data');

  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) return;

  const yesterday = getYesterday();
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
  const REFRESH_BEFORE_DAYS = parseInt(process.env.TOKEN_REFRESH_BEFORE_DAYS || '3');

  await TenantModel.updateSyncStatus(tenantId, 'syncing');

  try {
    // 检查并刷新token
    let appAuthToken = decrypt(tenant.app_auth_token || '', ENCRYPTION_KEY);
    let refreshTokenValue = decrypt(tenant.refresh_token || '', ENCRYPTION_KEY);

    if (tenant.app_auth_token_expires_at) {
      const expiresAt = new Date(tenant.app_auth_token_expires_at);
      const refreshThreshold = new Date();
      refreshThreshold.setDate(refreshThreshold.getDate() + REFRESH_BEFORE_DAYS);
      if (expiresAt <= refreshThreshold) {
        logger.info('SYNC', `Token即将过期，刷新中: tenantId=${tenantId}`);
        const newToken = await refreshAuthToken(refreshTokenValue);
        const { encrypt } = await import('../../shared/utils');
        appAuthToken = newToken.appAuthToken;
        refreshTokenValue = newToken.refreshToken;
        await TenantModel.updateRefreshToken(
          tenantId,
          encrypt(newToken.appAuthToken, ENCRYPTION_KEY),
          encrypt(newToken.refreshToken, ENCRYPTION_KEY),
          new Date(newToken.expiresAt)
        );
      }
    }

    // 查询数据
    const allData = await queryDeviceMetricsAll(appAuthToken, yesterday, {
      onProgress: (current, total) => {
        logger.info('SYNC', `同步进度: tenantId=${tenantId}, ${current}/${total}`);
      },
    });

    // 删除当日已有数据（幂等）
    await DeviceMetricsModel.deleteByTenantAndDate(tenantId, yesterday);

    // 映射并写入
    const mappedData = allData.map(item => mapDeviceData(tenantId, yesterday, item));
    const insertedCount = await DeviceMetricsModel.batchInsert(mappedData);

    // 更新设备数
    const deviceCount = await DeviceMetricsModel.getDeviceCountByTenantId(tenantId);
    await TenantModel.updateDeviceCount(tenantId, deviceCount);
    await TenantModel.updateSyncStatus(tenantId, 'success');

    logger.info('SYNC', `同步完成: tenantId=${tenantId}, records=${insertedCount}`);
  } catch (err) {
    const error = err as Error;
    await TenantModel.updateSyncStatus(tenantId, 'failed', error.message);
    logger.error('SYNC', `同步失败: tenantId=${tenantId}`, error.message);
  }
}

// ============================================================
// 启动
// ============================================================

app.use(router.routes());
app.use(router.allowedMethods());

// 测试路由 - CloudBase 适配
router.get('/test', async (ctx) => {
  ctx.body = { success: true, message: 'Koa is working!' };
});

// CloudBase HTTP 触发器入口
export const handler = async (event: Record<string, unknown>) => {
  try {
    // 简单测试路由
    const path = (event.path || event.requestContext?.http?.path || '/') as string;
    
    // 处理路径 - 移除 /gateway 前缀
    let requestPath = path;
    if (requestPath.startsWith('/gateway')) {
      requestPath = requestPath.replace('/gateway', '') || '/';
    }
    
    logger.info('GATEWAY', `Request: path=${requestPath}`);
    
    // 简单路由处理
    if (requestPath === '/test' || requestPath === '/api/test') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'Koa is working!' }),
        isBase64Encoded: false,
      };
    }
    
    // 返回测试响应
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, path: requestPath }),
      isBase64Encoded: false,
    };
  } catch (err) {
    const error = err as Error;
    logger.error('GATEWAY', 'Handler error', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: error.message }),
      isBase64Encoded: false,
    };
  }
};

// 本地开发时直接启动
const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    logger.info('GATEWAY', `API 网关已启动: http://localhost:${port}`);
  });
}

export default app;
