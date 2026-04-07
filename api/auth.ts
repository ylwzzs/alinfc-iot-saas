/**
 * Vercel Serverless Function - 认证相关 API
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME || 'alinfc',
};

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

function setCorsHeaders(res: VercelResponse, req: VercelRequest) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const path = req.url?.split('?')[0] || '';

  try {
    // 健康检查
    if (path === '/api/health') {
      return res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
    }

    // 管理员登录
    if (path === '/api/auth/admin/login' && req.method === 'POST') {
      const { username, password } = req.body as any;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
      }

      const users = await query<any>('SELECT * FROM admin_users WHERE username = ?', [username]);
      const user = users[0];

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      if (user.status !== 1) {
        return res.status(403).json({ success: false, message: '账号已被禁用' });
      }

      await execute('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);

      const token = jwt.sign(
        { id: user.id, username: user.username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN as any }
      );

      return res.json({
        success: true,
        data: { token, user: { id: user.id, username: user.username, realName: user.real_name } },
      });
    }

    // 租户登录
    if (path === '/api/auth/tenant/login' && req.method === 'POST') {
      const { tenantName, password } = req.body as any;

      if (!tenantName || !password) {
        return res.status(400).json({ success: false, message: '租户名和密码不能为空' });
      }

      const tenants = await query<any>('SELECT * FROM tenants WHERE name = ?', [tenantName]);
      const tenant = tenants[0];

      if (!tenant) {
        return res.status(401).json({ success: false, message: '租户不存在' });
      }

      if (tenant.authorization_status !== 'authorized') {
        return res.status(403).json({ success: false, message: '租户尚未授权' });
      }

      if (tenant.status !== 1) {
        return res.status(403).json({ success: false, message: '租户已被禁用' });
      }

      const validPassword = password === tenant.name + '2024' || password === tenant.name;
      if (!validPassword) {
        return res.status(401).json({ success: false, message: '密码错误' });
      }

      const token = jwt.sign(
        { id: tenant.id, username: tenant.name, role: 'tenant', tenantId: tenant.id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN as any }
      );

      return res.json({
        success: true,
        data: { token, tenant: { id: tenant.id, name: tenant.name } },
      });
    }

    // 获取当前用户
    if (path === '/api/auth/user' && req.method === 'GET') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: '未登录' });
      }

      try {
        const payload = jwt.verify(token, JWT_SECRET);
        return res.json({ success: true, data: payload });
      } catch {
        return res.status(401).json({ success: false, message: '登录已过期' });
      }
    }

    return res.status(404).json({ success: false, message: '接口不存在' });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: error.message || '服务器错误' });
  }
}
