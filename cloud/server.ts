/**
 * 本地开发服务器入口
 * 使用方式: npm run local
 */
require('dotenv/config');

import http from 'http';
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { AdminUserModel, TenantModel, DeviceMetricsModel, SyncLogModel } from './shared/db/models';
import { logger, decrypt, getYesterdayDate, getRecentDays, encrypt } from './shared/utils';
import { generateAuthUrl } from './shared/alipay/auth';

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Debug: 确认 JWT_SECRET
console.log('[DEBUG] JWT_SECRET:', JWT_SECRET);

const app = new Koa();
const router = new Router();

// ============================================================
// 中间件
// ============================================================

// CORS 中间件
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

// 错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    logger.error('LOCAL_SERVER', `${error.message}`, ctx.path);
    ctx.status = error.status || 500;
    ctx.body = { success: false, message: error.message || '服务器内部错误' };
  }
});

// 类型定义
interface CtxState {
  user?: { id: number; username: string; role: 'admin' | 'tenant' };
  tenantId?: number;
}

declare module 'koa' {
  interface DefaultState extends CtxState {}
}

// ============================================================
// 认证中间件
// ============================================================

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
    } catch (err) {
      console.log('[DEBUG] JWT verify failed:', err.message);
      console.log('[DEBUG] Expected secret:', JWT_SECRET);
      ctx.status = 401;
      ctx.body = { success: false, message: '登录已过期，请重新登录' };
    }
  };
}

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

// 测试路由
router.get('/test', async (ctx) => {
  ctx.body = { success: true, message: '服务正常!' };
});

// 支付宝授权回调 - 代理到 authCallback 服务
router.get('/auth/callback', async (ctx) => {
  const callbackPort = process.env.AUTH_CALLBACK_PORT || '3001';
  const baseUrl = `http://localhost:${callbackPort}`;
  const queryString = ctx.querystring ? `?${ctx.querystring}` : '';
  const targetUrl = `${baseUrl}/auth/callback${queryString}`;

  console.log('[GATEWAY] 代理授权回调到:', targetUrl);

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
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value) {
          ctx.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      });

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
      console.error('[GATEWAY] 代理请求失败:', err.message);
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
  if (!user || !bcrypt.compareSync(password, user.password)) {
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
  // 简单密码校验
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

router.put('/api/admin/tenants/:id', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const { name, contact_name, contact_phone } = ctx.request.body as { name?: string; contact_name?: string; contact_phone?: string };
  await TenantModel.update(id, { name, contact_name, contact_phone });
  ctx.body = { success: true };
});

router.put('/api/admin/tenants/:id/status', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const { status } = ctx.request.body as { status: number };
  await TenantModel.updateStatus(id, status);
  ctx.body = { success: true };
});

router.delete('/api/admin/tenants/:id', authMiddleware(), adminGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  await TenantModel.delete(id);
  ctx.body = { success: true };
});

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
  const authUrl = generateAuthUrl(`${id}_${Date.now()}`, id);
  ctx.body = { success: true, data: { authUrl } };
});

// 扫码授权 - 返回二维码内容
router.get('/api/admin/tenants/:id/auth-qrcode', authMiddleware(), adminGuard(), async (ctx) => {
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
  
  // 生成带 state 的授权 URL
  const state = JSON.stringify({ tenantId: id, nonce: Math.random().toString(36).slice(2, 15) });
  const REDIRECT_URI = process.env.ALIPAY_REDIRECT_URI || '';
  const APP_ID = process.env.ALIPAY_APP_ID || '';
  
  // 支付宝授权跳转 URL
  const authUrl = `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=auth_base&state=${encodeURIComponent(state)}`;
  
  // 生成二维码图片 URL (使用第三方 QR Code API)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(authUrl)}`;
  
  ctx.body = { 
    success: true, 
    data: { 
      authUrl,
      qrCodeUrl,
      state,
      expireSeconds: 300 // 二维码 5 分钟有效
    } 
  };
});

router.get('/api/admin/overview', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantStats = await TenantModel.getStats();
  const { start, end } = getRecentDays(30);
  const dailySummary = await DeviceMetricsModel.getGlobalDailySummary(start, end);
  const tenantRanking = await DeviceMetricsModel.getTenantRanking(start, end, 10);
  const yesterday = getYesterdayDate();
  const yesterdayData = await DeviceMetricsModel.getGlobalDailySummary(yesterday, yesterday);
  const yesterdaySummary = yesterdayData[0] || { total_amount: 0, total_transactions: 0, device_count: 0 };
  ctx.body = {
    success: true,
    data: { tenantStats, yesterdaySummary, dailySummary, tenantRanking },
  };
});

router.get('/api/admin/sync-logs', authMiddleware(), adminGuard(), async (ctx) => {
  const { limit = '50' } = ctx.query;
  const logs = await SyncLogModel.findRecent(parseInt(limit as string));
  ctx.body = { success: true, data: logs };
});

router.post('/api/admin/sync/:tenantId', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);
  ctx.body = { success: true, message: '同步功能暂不可用（需要支付宝配置）' };
});

// ============================================================
// 租户路由
// ============================================================

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

router.put('/api/tenant/info', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { contact_name, contact_phone } = ctx.request.body as { contact_name?: string; contact_phone?: string };
  await TenantModel.update(tenantId, { contact_name, contact_phone });
  ctx.body = { success: true };
});

router.get('/api/tenant/dashboard', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { start, end } = getRecentDays(30);
  const dailySummary = await DeviceMetricsModel.getDailySummary(tenantId, start, end);
  const storeRanking = await DeviceMetricsModel.getStoreRanking(tenantId, start, end, 10);
  const provinceStats = await DeviceMetricsModel.getProvinceStats(tenantId, start, end);
  const yesterday = getYesterdayDate();
  const yesterdayData = await DeviceMetricsModel.getDailySummary(tenantId, yesterday, yesterday);
  const yesterdaySummary = yesterdayData[0] || {};
  ctx.body = {
    success: true,
    data: { dailySummary, storeRanking, provinceStats, yesterdaySummary },
  };
});

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

router.get('/api/tenant/sync-logs', authMiddleware(), tenantGuard(), async (ctx) => {
  const logs = await SyncLogModel.findByTenant(ctx.state.tenantId!, 30);
  ctx.body = { success: true, data: logs };
});

router.post('/api/tenant/sync', authMiddleware(), tenantGuard(), async (ctx) => {
  ctx.body = { success: true, message: '同步功能暂不可用（需要支付宝配置）' };
});

// ============================================================
// 启动服务器
// ============================================================

app.use(router.routes());
app.use(router.allowedMethods());

const server = http.createServer(app.callback());

server.listen(PORT, () => {
  logger.info('LOCAL_SERVER', `本地服务器已启动: http://localhost:${PORT}`);
  logger.info('LOCAL_SERVER', `API 地址: http://localhost:${PORT}/api`);
});

export default app;
