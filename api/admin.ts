/**
 * Vercel Serverless Function - 管理员 API
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

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

function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

function isAdmin(user: any): boolean {
  return user?.role === 'admin';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const path = req.url?.split('?')[0] || '';
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    // 验证登录
    if (!token) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    let user: any;
    try {
      user = verifyToken(token);
    } catch {
      return res.status(401).json({ success: false, message: '登录已过期' });
    }

    // 验证管理员权限
    if (!isAdmin(user)) {
      return res.status(403).json({ success: false, message: '无权限' });
    }

    // 获取租户列表
    if (path === '/api/admin/tenants' && req.method === 'GET') {
      const { page = '1', pageSize = '20', keyword, status, authStatus } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

      let sql = 'SELECT id, name, contact_name, contact_phone, authorization_status, status, device_count, created_at, last_sync_at FROM tenants WHERE 1=1';
      const params: any[] = [];

      if (keyword) {
        sql += ' AND name LIKE ?';
        params.push(`%${keyword}%`);
      }
      if (status !== undefined) {
        sql += ' AND status = ?';
        params.push(parseInt(status as string));
      }
      if (authStatus) {
        sql += ' AND authorization_status = ?';
        params.push(authStatus);
      }

      const countSql = sql.replace('SELECT id, name, contact_name, contact_phone, authorization_status, status, device_count, created_at, last_sync_at', 'SELECT COUNT(*) as total');
      const countResult = await query<{ total: number }>(countSql, params);

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize as string), offset);

      const tenants = await query(sql, params);

      return res.json({
        success: true,
        data: {
          list: tenants,
          total: countResult[0]?.total || 0,
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string),
        },
      });
    }

    // 创建租户
    if (path === '/api/admin/tenants' && req.method === 'POST') {
      const { name, contact_name, contact_phone } = req.body as any;

      if (!name) {
        return res.status(400).json({ success: false, message: '租户名称不能为空' });
      }

      const existing = await query('SELECT id FROM tenants WHERE name = ?', [name]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: '租户名称已存在' });
      }

      await execute(
        'INSERT INTO tenants (name, contact_name, contact_phone, status, authorization_status, created_at) VALUES (?, ?, ?, 1, "pending", NOW())',
        [name, contact_name, contact_phone]
      );

      return res.json({ success: true, message: '创建成功' });
    }

    // 更新租户信息
    if (path.match(/^\/api\/admin\/tenants\/\d+$/) && req.method === 'PUT') {
      const id = path.split('/')[4];
      const { name, contact_name, contact_phone } = req.body as any;

      await execute(
        'UPDATE tenants SET name = ?, contact_name = ?, contact_phone = ? WHERE id = ?',
        [name, contact_name, contact_phone, id]
      );

      return res.json({ success: true, message: '更新成功' });
    }

    // 更新租户状态
    if (path.match(/^\/api\/admin\/tenants\/\d+\/status$/) && req.method === 'PUT') {
      const id = path.split('/')[4];
      const { status } = req.body as any;

      await execute('UPDATE tenants SET status = ? WHERE id = ?', [status, id]);
      return res.json({ success: true, message: '状态更新成功' });
    }

    // 删除租户
    if (path.match(/^\/api\/admin\/tenants\/\d+$/) && req.method === 'DELETE') {
      const id = path.split('/')[4];
      await execute('DELETE FROM tenants WHERE id = ?', [id]);
      return res.json({ success: true, message: '删除成功' });
    }

    // 获取概览数据
    if (path === '/api/admin/overview' && req.method === 'GET') {
      const tenantStats = await query<any>('SELECT COUNT(*) as total, SUM(CASE WHEN authorization_status = "authorized" THEN 1 ELSE 0 END) as authorized FROM tenants');
      const yesterdayStats = await query<any>('SELECT COUNT(*) as device_count FROM devices');

      return res.json({
        success: true,
        data: {
          tenantStats: tenantStats[0] || { total: 0, authorized: 0 },
          deviceCount: yesterdayStats[0]?.device_count || 0,
        },
      });
    }

    return res.status(404).json({ success: false, message: '接口不存在' });

  } catch (error: any) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ success: false, message: error.message || '服务器错误' });
  }
}
