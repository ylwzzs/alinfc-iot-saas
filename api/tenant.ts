/**
 * Vercel Serverless Function - 租户 API
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const path = req.url?.split('?')[0] || '';
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    if (!token) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    let user: any;
    try {
      user = verifyToken(token);
    } catch {
      return res.status(401).json({ success: false, message: '登录已过期' });
    }

    const tenantId = user?.tenantId || user?.id;
    if (!tenantId && user?.role !== 'tenant') {
      return res.status(403).json({ success: false, message: '无租户权限' });
    }

    // 获取租户信息
    if (path === '/api/tenant/info' && req.method === 'GET') {
      const tenants = await query<any>(
        'SELECT id, name, contact_name, contact_phone, authorization_status, device_count, created_at FROM tenants WHERE id = $1',
        [tenantId]
      );
      if (tenants.length === 0) {
        return res.status(404).json({ success: false, message: '租户不存在' });
      }
      return res.json({ success: true, data: tenants[0] });
    }

    // 获取 Dashboard 数据
    if (path === '/api/tenant/dashboard' && req.method === 'GET') {
      const stats = await query<any>(
        'SELECT COUNT(*) as total_devices FROM devices WHERE tenant_id = $1',
        [tenantId]
      );

      return res.json({
        success: true,
        data: {
          stats: stats[0] || { total_devices: 0 },
        },
      });
    }

    // 获取设备列表
    if (path === '/api/tenant/devices' && req.method === 'GET') {
      const { page = '1', pageSize = '20', sn } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

      let sql = 'SELECT * FROM devices WHERE tenant_id = $1';
      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (sn) {
        sql += ` AND sn LIKE $${paramIndex++}`;
        params.push(`%${sn}%`);
      }

      sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(parseInt(pageSize as string), offset);

      const devices = await query(sql, params);

      return res.json({
        success: true,
        data: {
          list: devices,
          total: devices.length,
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string),
        },
      });
    }

    // 获取同步日志
    if (path === '/api/tenant/sync/logs' && req.method === 'GET') {
      const limit = parseInt((req.query.limit as string) || '30');

      const logs = await query<any>(
        'SELECT * FROM sync_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
        [tenantId, limit]
      );

      return res.json({ success: true, data: logs });
    }

    return res.status(404).json({ success: false, message: '接口不存在' });

  } catch (error: any) {
    console.error('Tenant API Error:', error);
    return res.status(500).json({ success: false, message: error.message || '服务器错误' });
  }
}
