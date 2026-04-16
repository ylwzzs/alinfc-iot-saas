/**
 * 健康检查 API
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.mytech_SUPABASE_URL;
const supabaseKey = process.env.mytech_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let dbStatus = 'ok';
  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('admin_users').select('id').limit(1);
      if (error) dbStatus = 'error: ' + error.message;
    } else {
      dbStatus = 'error: missing credentials';
    }
  } catch (e: any) {
    dbStatus = 'error: ' + e.message;
  }

  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'supabase',
    dbStatus
  });
}
