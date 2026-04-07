/**
 * 模块化服务入口
 */
require('dotenv/config');

import http from 'http';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/node';
import {
  config,
  logger,
  cache,
  db,
  queue,
  traceMiddleware,
  requestLogger,
  errorHandler,
  corsMiddleware,
  authMiddleware,
  adminGuard,
} from './core';

// 初始化 Sentry 错误追踪
const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

if (SENTRY_DSN && ENVIRONMENT === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.nodeContextIntegration(),
    ],
    // 性能监控采样率
    tracesSampleRate: 0.1,
    // 忽略特定错误
    ignoreErrors: [
      'Network Error',
      '登录已过期',
      'Unauthorized',
    ],
    // 版本信息
    release: process.env.APP_VERSION || '1.0.0',
  });

  logger.info('SERVER', 'Sentry 错误追踪已初始化');
}

// 导入路由
import { adminTenantRoutes, tenantInfoRoutes } from './modules/tenant/routes';
import { adminModuleRoutes, tenantModuleRoutes } from './modules/module-manager/routes';
import { tenantDeviceRoutes, adminDeviceRoutes } from './modules/device/routes';
import { adminSyncRoutes, tenantSyncRoutes } from './modules/sync/routes';
import { authRoutes } from './modules/auth/routes';
import { exportRoutes } from './modules/export/routes';
import { monitorRoutes } from './modules/monitor/routes';

// 导入服务
import { syncService } from './modules/sync/service';
import { moduleService } from './modules/module-manager/service';
import { exportService } from './modules/export/service';
import { monitorService } from './modules/monitor/service';
import { tenantRepository } from './modules/tenant/repository';

const app = new Koa();
const PORT = config.server.port;

// ============================================================
// 中间件注册
// ============================================================

app.use(traceMiddleware());
app.use(requestLogger());
app.use(errorHandler());
app.use(corsMiddleware());
app.use(bodyParser());

// ============================================================
// 路由注册
// ============================================================

// 测试路由
app.use(async (ctx, next) => {
  if (ctx.path === '/test') {
    ctx.body = { success: true, message: '服务正常!' };
    return;
  }
  await next();
});

// 注册业务路由
app.use(adminTenantRoutes.routes());
app.use(adminTenantRoutes.allowedMethods());
app.use(tenantInfoRoutes.routes());
app.use(tenantInfoRoutes.allowedMethods());
app.use(adminModuleRoutes.routes());
app.use(adminModuleRoutes.allowedMethods());
app.use(tenantModuleRoutes.routes());
app.use(tenantModuleRoutes.allowedMethods());
app.use(tenantDeviceRoutes.routes());
app.use(tenantDeviceRoutes.allowedMethods());
app.use(adminDeviceRoutes.routes());
app.use(adminDeviceRoutes.allowedMethods());
app.use(adminSyncRoutes.routes());
app.use(adminSyncRoutes.allowedMethods());
app.use(tenantSyncRoutes.routes());
app.use(tenantSyncRoutes.allowedMethods());
app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());
app.use(exportRoutes.routes());
app.use(exportRoutes.allowedMethods());
app.use(monitorRoutes.routes());
app.use(monitorRoutes.allowedMethods());

// ============================================================
// 登录路由
// ============================================================

// 管理员登录
app.use(async (ctx, next) => {
  if (ctx.path === '/api/auth/admin/login' && ctx.method === 'POST') {
    const { username, password } = ctx.request.body as { username: string; password: string };

    if (!username || !password) {
      ctx.status = 400;
      ctx.body = { success: false, message: '用户名和密码不能为空' };
      return;
    }

    // 查询管理员
    const [user] = await db.query<any[]>('SELECT * FROM admin_users WHERE username = ?', [username]);
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

    // 更新登录时间
    await db.execute('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);

    // 生成 token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'admin' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    ctx.body = {
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, realName: user.real_name },
      },
    };
    return;
  }
  await next();
});

// 租户登录
app.use(async (ctx, next) => {
  if (ctx.path === '/api/auth/tenant/login' && ctx.method === 'POST') {
    const { tenantName, password } = ctx.request.body as { tenantName: string; password: string };

    if (!tenantName || !password) {
      ctx.status = 400;
      ctx.body = { success: false, message: '租户名和密码不能为空' };
      return;
    }

    const tenant = await tenantRepository.findByName(tenantName);
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
    const validPassword = password === tenant.name + '2024' || password === tenant.name;
    if (!validPassword) {
      ctx.status = 401;
      ctx.body = { success: false, message: '密码错误' };
      return;
    }

    const token = jwt.sign(
      { id: tenant.id, username: tenant.name, role: 'tenant', tenantId: tenant.id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    ctx.body = {
      success: true,
      data: {
        token,
        tenant: { id: tenant.id, name: tenant.name, contactName: tenant.contact_name },
      },
    };
    return;
  }
  await next();
});

// 获取当前用户信息
app.use(async (ctx, next) => {
  if (ctx.path === '/api/auth/user' && ctx.method === 'GET') {
    const token = ctx.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      ctx.status = 401;
      ctx.body = { success: false, message: '未登录' };
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as any;
      ctx.body = { success: true, data: payload };
    } catch {
      ctx.status = 401;
      ctx.body = { success: false, message: '登录已过期' };
    }
    return;
  }
  await next();
});

// ============================================================
// 启动服务
// ============================================================

async function start() {
  try {
    // 初始化 Redis
    await cache.connect();
    logger.info('SERVER', 'Redis 连接成功');

    // 初始化数据库
    logger.info('SERVER', '数据库连接池已初始化');

    // 初始化系统模块
    await moduleService.getSystemModules();
    logger.info('SERVER', '系统模块已初始化');

    // 初始化同步服务
    syncService.init();
    exportService.init();
    queue.start();
    logger.info('SERVER', '同步服务已启动');

    // 启动 HTTP 服务
    const server = http.createServer(app.callback());

    server.listen(PORT, () => {
      logger.info('SERVER', `服务已启动: http://localhost:${PORT}`);
      logger.info('SERVER', `API 地址: http://localhost:${PORT}/api`);
    });

    // 优雅关闭
    const shutdown = async () => {
      logger.info('SERVER', '正在关闭服务...');
      server.close(async () => {
        await cache.close();
        await db.close();
        // 关闭 Sentry
        if (SENTRY_DSN && ENVIRONMENT === 'production') {
          await Sentry.close(2000);
        }
        logger.info('SERVER', '服务已关闭');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // 捕获未处理的异常
    process.on('uncaughtException', (error) => {
      logger.error('SERVER', '未处理的异常', { error: error.message });
      if (SENTRY_DSN && ENVIRONMENT === 'production') {
        Sentry.captureException(error);
      }
    });

    // 捕获未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason) => {
      logger.error('SERVER', '未处理的 Promise 拒绝', { reason: String(reason) });
      if (SENTRY_DSN && ENVIRONMENT === 'production') {
        Sentry.captureException(reason);
      }
    });

  } catch (error) {
    logger.error('SERVER', '启动失败', { error: (error as Error).message });
    if (SENTRY_DSN && ENVIRONMENT === 'production') {
      Sentry.captureException(error);
    }
    process.exit(1);
  }
}

start();

export default app;
