const { AlipaySdk } = require('alipay-sdk');

let alipayInstance: any = null;

export function getAlipayClient(): any {
  if (!alipayInstance) {
    const config: any = {
      appId: process.env.ALIPAY_APP_ID || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
      signType: 'RSA2',
      charset: 'utf-8',
      timeout: 30000,
    };
    alipayInstance = new AlipaySdk(config);
  }
  return alipayInstance;
}
