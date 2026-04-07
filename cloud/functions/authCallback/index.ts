// 加载环境变量 - 使用绝对路径
import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/Duo/Documents/MytechCode/alinfc/cloud/.env' });

import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';

// Debug: 打印端口配置
console.log('[AUTH_CALLBACK] PORT:', process.env.PORT, 'AUTH_CALLBACK_PORT:', process.env.AUTH_CALLBACK_PORT, 'DB_HOST:', process.env.DB_HOST);

import { exchangeToken } from '../../shared/alipay/auth';
import { TenantModel } from '../../shared/db/models';
import { logger, encrypt } from '../../shared/utils';

const app = new Koa();
const router = new Router();

app.use(bodyParser());

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

/**
 * 支付宝第三方授权回调
 * 支付宝会重定向到此接口，带上 app_auth_code 和 state 参数
 */
router.get('/auth/callback', async (ctx) => {
  const { app_auth_code, state, app_id } = ctx.query as Record<string, string>;

  logger.info('AUTH_CALLBACK', '收到授权回调', { app_id, state });

  if (!app_auth_code) {
    ctx.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/result?status=error&message=缺少授权码`);
    return;
  }

  // 解析 state 获取 tenantId
  let tenantId: number;
  try {
    const stateData = JSON.parse(decodeURIComponent(state));
    tenantId = parseInt(stateData.tenantId);
    if (isNaN(tenantId)) throw new Error('无效的租户ID');
  } catch {
    ctx.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/result?status=error&message=无效的授权参数`);
    return;
  }

  // 检查租户
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    ctx.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/result?status=error&message=租户不存在`);
    return;
  }

  if (tenant.authorization_status === 'authorized') {
    ctx.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/result?status=error&message=租户已授权，不能重复授权`);
    return;
  }

  try {
    // 用授权码换取 token
    const tokenResult = await exchangeToken(app_auth_code);

    // 加密存储
    const encryptedToken = encrypt(tokenResult.appAuthToken, ENCRYPTION_KEY);
    const encryptedRefreshToken = encrypt(tokenResult.refreshToken, ENCRYPTION_KEY);

    // 更新数据库
    await TenantModel.updateRefreshToken(tenantId, encryptedToken, encryptedRefreshToken, new Date(tokenResult.expiresAt));

    logger.info('AUTH_CALLBACK', '授权成功', { tenantId, tenantName: tenant.name });

    ctx.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/result?status=success&tenantName=${encodeURIComponent(tenant.name)}`
    );
  } catch (err) {
    const error = err as Error;
    logger.error('AUTH_CALLBACK', '授权失败', { tenantId, error: error.message });
    ctx.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/result?status=error&message=${encodeURIComponent(error.message)}`
    );
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

// CloudBase HTTP 触发器入口
export const handler = async (event: Record<string, unknown>) => {
  const { path, queryStringParameters, headers } = event as Record<string, unknown>;
  const req: any = {
    method: 'GET',
    url: `${path || '/auth/callback'}?${new URLSearchParams(queryStringParameters as Record<string, string> || {}).toString()}`,
    headers: headers as Record<string, string> || {},
    query: queryStringParameters as Record<string, string> || {},
    body: {},
  };

  return new Promise((resolve) => {
    app.callback()(req as any, {
      setHeader: () => {},
      end: (chunk: string) => resolve({
        statusCode: 302,
        headers: {
          'Location': chunk.includes('redirect') ? '' : '',
          'Content-Type': 'text/html',
        },
        body: chunk,
        isBase64Encoded: false,
      }),
      statusCode: 302,
      set: (k: string, v: string) => {
        if (k === 'Location') {
          resolve({
            statusCode: 302,
            headers: { Location: v },
            body: '',
            isBase64Encoded: false,
          });
        }
      },
      getHeader: () => '',
    } as any);
  });
};

// 本地开发 - 使用专用的 AUTH_CALLBACK_PORT
const port = process.env.AUTH_CALLBACK_PORT || 3001;
if (require.main === module) {
  app.listen(port, () => {
    logger.info('AUTH_CALLBACK', `授权回调服务已启动: http://localhost:${port}`);
  });
}

export default app;
