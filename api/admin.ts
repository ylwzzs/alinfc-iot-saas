/**
 * 管理员 API
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.mytech_SUPABASE_URL;
const supabaseKey = process.env.mytech_SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function auth(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: '未登录' });

  let user: any;
  try {
    user = auth(token);
  } catch {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }

  const supabase = createClient(supabaseUrl!, supabaseKey!);
  const path = req.url?.split('?')[0] || '';

  try {
    // 获取租户列表
    if (path === '/api/admin/tenants' && req.method === 'GET') {
      const { page = '1', pageSize = '20', keyword } = req.query;
      const limit = parseInt(pageSize as string);
      const offset = (parseInt(page as string) - 1) * limit;

      let query = supabase.from('tenants').select('*', { count: 'exact' });
      if (keyword) {
        query = query.ilike('name', `%${keyword}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return res.json({
        success: true,
        data: { list: data, total: count || 0, page: parseInt(page as string), pageSize: limit }
      });
    }

    // 创建租户
    if (path === '/api/admin/tenants' && req.method === 'POST') {
      const { name, contact_name, contact_phone } = req.body as any;

      if (!name) {
        return res.status(400).json({ success: false, message: '租户名称不能为空' });
      }

      const { data: existing } = await supabase.from('tenants').select('id').eq('name', name).limit(1);
      if (existing?.length) {
        return res.status(409).json({ success: false, message: '租户名称已存在' });
      }

      const { error } = await supabase.from('tenants').insert({
        name, contact_name, contact_phone, status: 1, authorization_status: 'pending'
      });

      if (error) throw error;
      return res.json({ success: true, message: '创建成功' });
    }

    // 更新租户状态
    if (path.match(/^\/api\/admin\/tenants\/\d+\/status$/) && req.method === 'PUT') {
      const id = path.split('/')[4];
      const { status } = req.body as any;
      const { error } = await supabase.from('tenants').update({ status }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: '更新成功' });
    }

    // 删除租户
    if (path.match(/^\/api\/admin\/tenants\/\d+$/) && req.method === 'DELETE') {
      const id = path.split('/')[4];
      const { error } = await supabase.from('tenants').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: '删除成功' });
    }

    // 概览
    if (path === '/api/admin/overview' && req.method === 'GET') {
      const { count: total } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
      const { count: authorized } = await supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('authorization_status', 'authorized');

      return res.json({
        success: true,
        data: { tenantStats: { total: total || 0, authorized: authorized || 0 } }
      });
    }

    return res.status(404).json({ success: false, message: '接口不存在' });

  } catch (error: any) {
    console.error('Admin Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
