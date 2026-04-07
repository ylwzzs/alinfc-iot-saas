import { getAlipayClient } from './client';

const BASE_URL = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
const APP_ID = process.env.ALIPAY_APP_ID || '';
const REDIRECT_URI = process.env.ALIPAY_REDIRECT_URI || '';

/**
 * 生成支付宝网页授权 URL
 */
export function generateAuthUrl(state: string, tenantId: number): string {
  const params = new URLSearchParams({
    app_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'auth_base',
    state: encodeURIComponent(JSON.stringify({ tenantId, nonce: state })),
  });
  return `https://openauth.alipay.com/oauth2/appToAppAuth.htm?${params.toString()}`;
}

/**
 * 生成扫码授权二维码 URL
 * 返回二维码内容和二维码图片 URL
 */
export async function generateScanAuthUrl(tenantId: number): Promise<{
  qrCode: string;      // 二维码内容 URL
  qrCodeUrl: string;  // 二维码图片 URL
  authUrl: string;    // 完整授权跳转 URL（用于二维码扫描后跳转）
}> {
  const client = getAlipayClient();
  const state = JSON.stringify({ tenantId, nonce: Math.random().toString(36).slice(2) });
  
  // 授权跳转 URL（用户扫码后跳转的页面）
  const authUrl = `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=auth_base&state=${encodeURIComponent(state)}`;
  
  // 生成二维码内容
  const qrCode = authUrl;
  
  // 使用支付宝接口生成二维码图片
  const result = await client.exec('alipay.open.appqrcode.create', {
    qrCodeView: {
      product_type: 'app授权',
      biz_data: {
        auth_url: authUrl,
        state: state,
      }
    },
    development_id: 'alipay',
    version: '1.0',
  });

  console.log('[支付宝二维码生成]', result);
  
  // 如果接口成功，返回二维码链接
  if ((result as any).code === '10000') {
    return {
      qrCode: qrCode,
      qrCodeUrl: (result as any).qr_code || '',
      authUrl: authUrl,
    };
  }

  // 如果接口不支持，返回原始 URL
  return {
    qrCode: qrCode,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`,
    authUrl: authUrl,
  };
}

/**
 * 用授权码换取 token
 */
export async function exchangeToken(appAuthCode: string): Promise<{
  appAuthToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: string;
}> {
  const client = getAlipayClient();
  const result = await client.exec('alipay.open.auth.token.app', {
    grantType: 'authorization_code',
    code: appAuthCode,
  });

  const response = (result as Record<string, Record<string, unknown>>).alipay_open_auth_token_app_response;
  if (!response || response.code !== '10000') {
    throw new Error(`获取token失败: ${response?.msg || response?.sub_msg || '未知错误'}`);
  }

  const appAuthToken = response.app_auth_token as string;
  const refreshToken = response.app_auth_token as string; // refresh_token 在同一层级
  const expiresIn = response.expires_in as number;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return { appAuthToken, refreshToken, expiresIn, expiresAt };
}

/**
 * 刷新 token
 */
export async function refreshAuthToken(refreshTokenValue: string): Promise<{
  appAuthToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: string;
}> {
  const client = getAlipayClient();
  const result = await client.exec('alipay.open.auth.token.app', {
    grantType: 'refresh_token',
    refresh_token: refreshTokenValue,
  });

  const response = (result as Record<string, Record<string, unknown>>).alipay_open_auth_token_app_response;
  if (!response || response.code !== '10000') {
    throw new Error(`刷新token失败: ${response?.msg || response?.sub_msg || '未知错误'}`);
  }

  const appAuthToken = response.app_auth_token as string;
  const newRefreshToken = response.app_auth_token as string;
  const expiresIn = response.expires_in as number;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return { appAuthToken, refreshToken: newRefreshToken, expiresIn, expiresAt };
}
