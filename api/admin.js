/**
 * 管理员 API
 */
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: '未登录' });

  const JWT_SECRET = process.env.JWT_SECRET || 'alinfc-default-secret-2024';
  let user;

  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }

  const supabaseUrl = process.env.mytech_SUPABASE_URL;
  const supabaseKey = process.env.mytech_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ success: false, message: '数据库配置缺失' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const path = req.url?.split('?')[0] || '';

  try {
    // 获取租户列表
    if (path === '/api/admin/tenants' && req.method === 'GET') {
      const { page = '1', pageSize = '20', keyword } = req.query || {};
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

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
        data: { list: data, total: count || 0, page: parseInt(page), pageSize: limit }
      });
    }

    // 创建租户
    if (path === '/api/admin/tenants' && req.method === 'POST') {
      const { name, contact_name, contact_phone } = req.body || {};

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

  } catch (error) {
    console.error('Admin Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};