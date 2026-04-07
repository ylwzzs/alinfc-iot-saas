/**
 * Vercel Serverless Function 入口
 * 统一 API 路由处理
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import http from 'http';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/node';

// 初始化 Sentry
const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.VERCEL_ENV || 'development';

if (SENTRY_DSN && ENVIRONMENT === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: 0.1,
  });
}

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME || 'alinfc',
};

// 简单的 MySQL 查询函数
async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T[];
  } finally {
    await connection.end();
  }
}

async function execute(sql: string, params: any[] = []): Promise<void> {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(dbConfig);
  try {
    await connection.execute(sql, params);
  } finally {
    await connection.end();
  }
}

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 创建 Koa 应用
const app = new Koa();

// CORS 中间件
app.use(async (ctx, next) => {
  const origin = ctx.get('Origin') || '*';
  ctx.set('Access-Control-Allow-Origin', origin);
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = { success: false, message: err.message || '服务器错误' };
    if (SENTRY_DSN && ENVIRONMENT === 'production') {
      Sentry.captureException(err);
    }
  }
});

// ============================================================
// API 路由
// ============================================================

// 健康检查
app.use(async (ctx, next) => {
  if (ctx.path === '/api/health') {
    ctx.body = { success: true, status: 'healthy', timestamp: new Date().toISOString() };
    return;
  }
  await next();
});

// 管理员登录
app.use(async (ctx, next) => {
  if (ctx.path === '/api/auth/admin/login' && ctx.method === 'POST') {
    const { username, password } = ctx.request.body as any;

    if (!username || !password) {
      ctx.status = 400;
      ctx.body = { success: false, message: '用户名和密码不能为空' };
      return;
    }

    const users = await query<any>('SELECT * FROM admin_users WHERE username = ?', [username]);
    const user = users[0];

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

    await execute('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    ctx.body = {
      success: true,
      data: { token, user: { id: user.id, username: user.username, realName: user.real_name } },
    };
    return;
  }
  await next();
});

// 租户登录
app.use(async (ctx, next) => {
  if (ctx.path === '/api/auth/tenant/login' && ctx.method === 'POST') {
    const { tenantName, password } = ctx.request.body as any;

    if (!tenantName || !password) {
      ctx.status = 400;
      ctx.body = { success: false, message: '租户名和密码不能为空' };
      return;
    }

    const tenants = await query<any>('SELECT * FROM tenants WHERE name = ?', [tenantName]);
    const tenant = tenants[0];

    if (!tenant) {
      ctx.status = 401;
      ctx.body = { success: false, message: '租户不存在' };
      return;
    }

    if (tenant.authorization_status !== 'authorized') {
      ctx.status = 403;
      ctx.body = { success: false, message: '租户尚未授权' };
      return;
    }

    if (tenant.status !== 1) {
      ctx.status = 403;
      ctx.body = { success: false, message: '租户已被禁用' };
      return;
    }

    const validPassword = password === tenant.name + '2024' || password === tenant.name;
    if (!validPassword) {
      ctx.status = 401;
      ctx.body = { success: false, message: '密码错误' };
      return;
    }

    const token = jwt.sign(
      { id: tenant.id, username: tenant.name, role: 'tenant', tenantId: tenant.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    ctx.body = {
      success: true,
      data: { token, tenant: { id: tenant.id, name: tenant.name } },
    };
    return;
  }
  await next();
});

// 获取当前用户
app.use(async (ctx, next) => {
  if (ctx.path === '/api/auth/user' && ctx.method === 'GET') {
    const token = ctx.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      ctx.status = 401;
      ctx.body = { success: false, message: '未登录' };
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      ctx.body = { success: true, data: payload };
    } catch {
      ctx.status = 401;
      ctx.body = { success: false, message: '登录已过期' };
    }
    return;
  }
  await next();
});

// 认证中间件
async function authMiddleware(ctx: any, next: any) {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    ctx.status = 401;
    ctx.body = { success: false, message: '未登录' };
    return;
  }
  try {
    ctx.state.user = jwt.verify(token, JWT_SECRET) as any;
    await next();
  } catch {
    ctx.status = 401;
    ctx.body = { success: false, message: '登录已过期' };
  }
}

// 管理员权限中间件
async function adminGuard(ctx: any, next: any) {
  if (ctx.state.user?.role !== 'admin') {
    ctx.status = 403;
    ctx.body = { success: false, message: '无权限' };
    return;
  }
  await next();
}

// 获取租户列表
app.use(async (ctx, next) => {
  if (ctx.path === '/api/admin/tenants' && ctx.method === 'GET') {
    await authMiddleware(ctx, async () => {
      await adminGuard(ctx, async () => {
        const { page = '1', pageSize = '20', keyword } = ctx.query;
        const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

        let sql = 'SELECT * FROM tenants';
        const params: any[] = [];

        if (keyword) {
          sql += ' WHERE name LIKE ?';
          params.push(`%${keyword}%`);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(pageSize as string), offset);

        const tenants = await query(sql, params);

        // 获取总数
        let countSql = 'SELECT COUNT(*) as total FROM tenants';
        if (keyword) {
          countSql += ' WHERE name LIKE ?';
        }
        const countResult = await query<{ total: number }>(countSql, keyword ? [`%${keyword}%`] : []);

        ctx.body = {
          success: true,
          data: {
            list: tenants.map(t => ({ ...t, app_auth_token: undefined, refresh_token: undefined })),
            total: countResult[0]?.total || 0,
            page: parseInt(page as string),
            pageSize: parseInt(pageSize as string),
          },
        };
      });
    });
    return;
  }
  await next();
});

// 创建租户
app.use(async (ctx, next) => {
  if (ctx.path === '/api/admin/tenants' && ctx.method === 'POST') {
    await authMiddleware(ctx, async () => {
      await adminGuard(ctx, async () => {
        const { name, contact_name, contact_phone } = ctx.request.body as any;

        if (!name) {
          ctx.status = 400;
          ctx.body = { success: false, message: '租户名称不能为空' };
          return;
        }

        const existing = await query('SELECT id FROM tenants WHERE name = ?', [name]);
        if (existing.length > 0) {
          ctx.status = 409;
          ctx.body = { success: false, message: '租户名称已存在' };
          return;
        }

        await execute(
          'INSERT INTO tenants (name, contact_name, contact_phone, status, authorization_status) VALUES (?, ?, ?, 1, "pending")',
          [name, contact_name, contact_phone]
        );

        ctx.body = { success: true, message: '创建成功' };
      });
    });
    return;
  }
  await next();
});

// 更新租户状态
app.use(async (ctx, next) => {
  if (ctx.path.match(/^\/api\/admin\/tenants\/\d+\/status$/) && ctx.method === 'PUT') {
    await authMiddleware(ctx, async () => {
      await adminGuard(ctx, async () => {
        const id = ctx.path.split('/')[4];
        const { status } = ctx.request.body as any;

        await execute('UPDATE tenants SET status = ? WHERE id = ?', [status, id]);
        ctx.body = { success: true, message: '更新成功' };
      });
    });
    return;
  }
  await next();
});

// 删除租户
app.use(async (ctx, next) => {
  if (ctx.path.match(/^\/api\/admin\/tenants\/\d+$/) && ctx.method === 'DELETE') {
    await authMiddleware(ctx, async () => {
      await adminGuard(ctx, async () => {
        const id = ctx.path.split('/')[4];
        await execute('DELETE FROM tenants WHERE id = ?', [id]);
        ctx.body = { success: true, message: '删除成功' };
      });
    });
    return;
  }
  await next();
});

// 租户信息
app.use(async (ctx, next) => {
  if (ctx.path === '/api/tenant/info' && ctx.method === 'GET') {
    await authMiddleware(ctx, async () => {
      const tenantId = ctx.state.user?.tenantId;
      if (!tenantId) {
        ctx.status = 403;
        ctx.body = { success: false, message: '无租户权限' };
        return;
      }

      const tenants = await query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
      if (tenants.length === 0) {
        ctx.status = 404;
        ctx.body = { success: false, message: '租户不存在' };
        return;
      }

      const { app_auth_token, refresh_token, ...safeTenant } = tenants[0] as any;
      ctx.body = { success: true, data: safeTenant };
    });
    return;
  }
  await next();
});

// 404 处理
app.use(async (ctx) => {
  ctx.status = 404;
  ctx.body = { success: false, message: '接口不存在' };
});

// 导出 Vercel handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 创建模拟的 Koa context
  const koaReq = {
    method: req.method || 'GET',
    url: req.url || '/',
    headers: req.headers as Record<string, string>,
    body: req.body,
    query: req.query as Record<string, string>,
  };

  return new Promise<void>((resolve) => {
    const mockRes = {
      status: 200,
      _headers: {} as Record<string, string>,
      _body: null as any,
      set(key: string, value: string) {
        this._headers[key] = value;
      },
      setHeader(key: string, value: string) {
        this._headers[key.toLowerCase()] = value;
      },
    };

    // 处理请求
    app.callback()(
      Object.assign(koaReq, { res: mockRes as any }),
      Object.assign(mockRes, {
        end: (body?: any) => {
          res.status(mockRes.status);
          Object.entries(mockRes._headers).forEach(([k, v]) => res.setHeader(k, v));
          res.json(mockRes._body || body);
          resolve();
        },
      }) as any
    ).then(() => {
      if (!res.headersSent) {
        res.status(mockRes.status);
        Object.entries(mockRes._headers).forEach(([k, v]) => res.setHeader(k, v));
        res.json(mockRes._body);
        resolve();
      }
    }).catch((err: Error) => {
      res.status(500).json({ success: false, message: err.message });
      resolve();
    });
  });
}
