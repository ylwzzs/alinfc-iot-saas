/**
 * 租户 API
 */
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

  const tenantId = user.tenantId || user.id;
  if (!tenantId) return res.status(403).json({ success: false, message: '无租户权限' });

  const supabaseUrl = process.env.mytech_SUPABASE_URL;
  const supabaseKey = process.env.mytech_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ success: false, message: '数据库配置缺失' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const path = req.url?.split('?')[0] || '';

  try {
    // 租户信息
    if (path === '/api/tenant/info' && req.method === 'GET') {
      const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).limit(1);
      if (error || !data?.length) {
        return res.status(404).json({ success: false, message: '租户不存在' });
      }
      return res.json({ success: true, data: data[0] });
    }

    // Dashboard
    if (path === '/api/tenant/dashboard' && req.method === 'GET') {
      const { count } = await supabase.from('devices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      return res.json({ success: true, data: { stats: { total_devices: count || 0 } } });
    }

    // 设备列表
    if (path === '/api/tenant/devices' && req.method === 'GET') {
      const { page = '1', pageSize = '20', sn } = req.query || {};
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

      let query = supabase.from('devices').select('*').eq('tenant_id', tenantId);
      if (sn) query = query.ilike('sn', `%${sn}%`);

      const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;

      return res.json({ success: true, data: { list: data, total: data.length, page: parseInt(page), pageSize: limit } });
    }

    return res.status(404).json({ success: false, message: '接口不存在' });

  } catch (error) {
    console.error('Tenant Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};