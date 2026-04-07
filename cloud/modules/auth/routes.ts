/**
 * 授权模块 - 路由
 */
import Router from '@koa/router';
import { authMiddleware, adminGuard } from '../../core/middleware';
import { tenantService } from '../tenant/service';
import { generateAuthUrl, exchangeToken } from '../../shared/alipay/auth';
import { config } from '../../core/config';
import { logger } from '../../core/logger';

const router = new Router({ prefix: '/api/admin/auth' });

/**
 * 获取租户授权链接
 */
router.get('/tenant/:tenantId/url', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);

  const tenant = await tenantService.getById(tenantId);
  if (!tenant) {
    ctx.status = 404;
    ctx.body = { success: false, message: '租户不存在' };
    return;
  }

  if (tenant.authorization_status === 'authorized') {
    ctx.status = 400;
    ctx.body = { success: false, message: '租户已授权' };
    return;
  }

  const state = JSON.stringify({ tenantId, nonce: Date.now() });
  const redirectUri = config.alipay.redirectUri;
  const appId = config.alipay.appId;

  const authUrl = `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=auth_base&state=${encodeURIComponent(state)}`;

  // 生成二维码图片 URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(authUrl)}`;

  ctx.body = {
    success: true,
    data: {
      authUrl,
      qrCodeUrl,
      state,
      expireSeconds: 300,
    },
  };
});

/**
 * 授权回调处理
 */
router.get('/callback', async (ctx) => {
  const { app_auth_code, state } = ctx.query;

  if (!app_auth_code || !state) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少授权参数' };
    return;
  }

  try {
    // 解析 state
    const stateData = JSON.parse(decodeURIComponent(state as string));
    const tenantId = stateData.tenantId;

    // 换取 token
    const tokenResult = await exchangeToken(app_auth_code as string);

    // 更新租户授权信息
    await tenantService.updateAuthStatus(tenantId, 'authorized', {
      authorizedAt: new Date(),
    });

    // 保存 token（实际应加密存储）
    // await tenantRepository.updateAuthToken(
    //   tenantId,
    //   tokenResult.appAuthToken,
    //   tokenResult.refreshToken,
    //   new Date(tokenResult.expiresAt)
    // );

    logger.info('AUTH', `租户授权成功`, { tenantId });

    // 重定向到前端授权成功页面
    ctx.redirect(`${config.frontend.url}/auth/result?status=success&tenantId=${tenantId}`);
  } catch (error) {
    logger.error('AUTH', `授权回调失败`, { error: (error as Error).message });
    ctx.redirect(`${config.frontend.url}/auth/result?status=failed&message=${encodeURIComponent((error as Error).message)}`);
  }
});

/**
 * 刷新租户 token
 */
router.post('/tenant/:tenantId/refresh', authMiddleware(), adminGuard(), async (ctx) => {
  const tenantId = parseInt(ctx.params.tenantId);

  // TODO: 实现刷新逻辑

  ctx.body = { success: true, message: 'Token 刷新成功' };
});

export { router as authRoutes };
