/**
 * 通用中间件模块
 */
import Koa from 'koa';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../logger';
import { cache } from '../cache';

// ==================== 类型定义 ====================

export interface CtxState {
  user?: {
    id: number;
    username: string;
    role: 'admin' | 'tenant';
    tenantId?: number;
  };
  tenantId?: number;
  traceId: string;
}

declare module 'koa' {
  interface DefaultState extends CtxState {}
}

// ==================== 追踪 ID 中间件 ====================

export function traceMiddleware(): Koa.Middleware<CtxState> {
  return async (ctx, next) => {
    const traceId = ctx.get('X-Trace-Id') || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    ctx.state.traceId = traceId;
    ctx.set('X-Trace-Id', traceId);
    await next();
  };
}

// ==================== 请求日志中间件 ====================

export function requestLogger(): Koa.Middleware<CtxState> {
  return async (ctx, next) => {
    const start = Date.now();
    const { method, url, ip } = ctx.request;

    logger.info('HTTP', `--> ${method} ${url}`, { ip, traceId: ctx.state.traceId });

    await next();

    const duration = Date.now() - start;
    const { status } = ctx.response;

    logger.info('HTTP', `<-- ${method} ${url} ${status}`, {
      duration: `${duration}ms`,
      traceId: ctx.state.traceId,
    });
  };
}

// ==================== 错误处理中间件 ====================

export function errorHandler(): Koa.Middleware {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err: unknown) {
      const error = err as Error & { status?: number; code?: string };

      ctx.status = error.status || 500;

      const message = error.message || '服务器内部错误';

      // 记录错误日志
      logger.error('ERROR', message, {
        status: ctx.status,
        code: error.code,
        stack: error.stack,
        traceId: ctx.state?.traceId,
      });

      ctx.body = {
        success: false,
        message,
        code: error.code,
        traceId: ctx.state?.traceId,
      };
    }
  };
}

// ==================== CORS 中间件 ====================

export function corsMiddleware(): Koa.Middleware {
  return async (ctx, next) => {
    const origin = ctx.get('Origin') || '*';
    ctx.set('Access-Control-Allow-Origin', origin);
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-Trace-Id');
    ctx.set('Access-Control-Expose-Headers', 'Authorization, Content-Length, X-Trace-Id');
    ctx.set('Access-Control-Allow-Credentials', 'true');

    if (ctx.method === 'OPTIONS') {
      ctx.status = 204;
      return;
    }

    await next();
  };
}

// ==================== 认证中间件 ====================

export function authMiddleware(optional = false): Koa.Middleware<CtxState> {
  return async (ctx, next) => {
    const token = ctx.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      if (optional) {
        await next();
        return;
      }
      ctx.status = 401;
      ctx.body = { success: false, message: '未登录', traceId: ctx.state.traceId };
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as {
        id: number;
        username: string;
        role: string;
        tenantId?: number;
      };

      ctx.state.user = {
        id: payload.id,
        username: payload.username,
        role: payload.role as 'admin' | 'tenant',
        tenantId: payload.tenantId,
      };

      if (payload.tenantId) {
        ctx.state.tenantId = payload.tenantId;
      }

      await next();
    } catch (err) {
      logger.warn('AUTH', 'Token 验证失败', { error: (err as Error).message, traceId: ctx.state.traceId });
      ctx.status = 401;
      ctx.body = { success: false, message: '登录已过期，请重新登录', traceId: ctx.state.traceId };
    }
  };
}

// ==================== 权限守卫中间件 ====================

export function adminGuard(): Koa.Middleware<CtxState> {
  return async (ctx, next) => {
    if (ctx.state.user?.role !== 'admin') {
      ctx.status = 403;
      ctx.body = { success: false, message: '无管理员权限', traceId: ctx.state.traceId };
      return;
    }
    await next();
  };
}

export function tenantGuard(): Koa.Middleware<CtxState> {
  return async (ctx, next) => {
    if (!ctx.state.tenantId) {
      ctx.status = 403;
      ctx.body = { success: false, message: '无租户权限', traceId: ctx.state.traceId };
      return;
    }
    await next();
  };
}

// ==================== 功能开关中间件 ====================

export function moduleGuard(moduleId: string): Koa.Middleware<CtxState> {
  return async (ctx, next) => {
    const tenantId = ctx.state.tenantId;
    if (!tenantId) {
      await next();
      return;
    }

    // 检查租户是否有该模块权限
    const cacheKey = `tenant:${tenantId}:modules`;
    let modules = await cache.get<string[]>(cacheKey);

    if (!modules) {
      // 从数据库加载（需要 module-manager 模块）
      // 这里简化处理，后续接入模块管理
      modules = ['dashboard', 'devices', 'analytics', 'export', 'sync'];
      await cache.set(cacheKey, modules, 300); // 缓存 5 分钟
    }

    if (!modules.includes(moduleId)) {
      ctx.status = 403;
      ctx.body = {
        success: false,
        message: '当前租户未开通该功能模块',
        traceId: ctx.state.traceId,
      };
      return;
    }

    await next();
  };
}

// ==================== 限流中间件 ====================

export function rateLimit(options: {
  windowMs?: number;  // 时间窗口（毫秒）
  max?: number;       // 最大请求数
  keyGenerator?: (ctx: Koa.Context) => string;
} = {}): Koa.Middleware<CtxState> {
  const {
    windowMs = 60000,  // 默认 1 分钟
    max = 100,         // 默认 100 次
    keyGenerator = (ctx) => ctx.ip,
  } = options;

  return async (ctx, next) => {
    const key = `ratelimit:${keyGenerator(ctx)}`;

    try {
      const count = await cache.incr(key);

      if (count === 1) {
        await cache.expire(key, Math.ceil(windowMs / 1000));
      }

      if (count > max) {
        ctx.status = 429;
        ctx.body = {
          success: false,
          message: '请求过于频繁，请稍后重试',
          traceId: ctx.state.traceId,
        };
        return;
      }

      ctx.set('X-RateLimit-Limit', String(max));
      ctx.set('X-RateLimit-Remaining', String(Math.max(0, max - count)));

      await next();
    } catch (err) {
      // Redis 出错时放行请求
      logger.error('RATELIMIT', '限流检查失败', { error: (err as Error).message });
      await next();
    }
  };
}

// ==================== 监控指标中间件 ====================

export function metricsMiddleware(): Koa.Middleware<CtxState> {
  return async (ctx, next) => {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    const { method, path, status } = ctx;

    // 记录请求耗时
    logger.debug('METRICS', `${method} ${path}`, {
      duration,
      status,
      traceId: ctx.state.traceId,
    });

    // 可以发送到 Prometheus/DataDog 等
    // 这里简单记录到 Redis
    try {
      const client = (cache as any).client;
      if (client) {
        // 记录 API 耗时分布
        await client.lPush('metrics:api:latency', JSON.stringify({
          path,
          method,
          duration,
          status,
          timestamp: Date.now(),
        }));
        // 只保留最近 1000 条
        await client.lTrim('metrics:api:latency', 0, 999);
      }
    } catch {
      // 忽略监控记录错误
    }
  };
}
