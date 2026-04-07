/**
 * 数据同步云函数 - 定时触发器
 * 每日凌晨自动拉取所有已授权租户的昨日设备数据
 */

import { TenantModel, DeviceMetricsModel, SyncLogModel } from '../../shared/db/models';
import { decrypt, encrypt, getYesterday, mapDeviceData, logger, sleep } from '../../shared/utils';
import { refreshAuthToken } from '../../shared/alipay/auth';
import { queryDeviceMetricsAll } from '../../shared/alipay/data';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const REFRESH_BEFORE_DAYS = parseInt(process.env.TOKEN_REFRESH_BEFORE_DAYS || '3');

interface SyncResult {
  tenantId: number;
  tenantName: string;
  status: 'success' | 'failed';
  records: number;
  error?: string;
  duration: number;
}

export const handler = async (event: Record<string, unknown> = {}) => {
  logger.info('DATA_SYNC', '========== 开始每日数据同步 ==========');
  const startTime = Date.now();

  const yesterday = getYesterday();
  logger.info('DATA_SYNC', `同步日期: ${yesterday}`);

  // 获取所有已授权租户
  const tenants = await TenantModel.findAuthorized();
  if (tenants.length === 0) {
    logger.info('DATA_SYNC', '没有已授权租户，跳过同步');
    return { success: true, message: '没有已授权租户', results: [] };
  }

  logger.info('DATA_SYNC', `共 ${tenants.length} 个已授权租户`);

  const results: SyncResult[] = [];

  for (const tenant of tenants) {
    const tenantStart = Date.now();
    const result: SyncResult = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      status: 'success',
      records: 0,
      duration: 0,
    };

    // 创建同步日志
    const logId = await SyncLogModel.create(tenant.id, yesterday);
    await SyncLogModel.update(logId, { status: 'running', started_at: new Date().toISOString() });
    await TenantModel.updateSyncStatus(tenant.id, 'syncing');

    try {
      // 1. 检查并刷新 token
      let appAuthToken = decrypt(tenant.app_auth_token || '', ENCRYPTION_KEY);
      let refreshTokenValue = decrypt(tenant.refresh_token || '', ENCRYPTION_KEY);

      if (tenant.app_auth_token_expires_at) {
        const expiresAt = new Date(tenant.app_auth_token_expires_at);
        const refreshThreshold = new Date();
        refreshThreshold.setDate(refreshThreshold.getDate() + REFRESH_BEFORE_DAYS);
        if (expiresAt <= refreshThreshold) {
          logger.info('DATA_SYNC', `Token即将过期，刷新中: tenant=${tenant.name}`);
          const newToken = await refreshAuthToken(refreshTokenValue);
          appAuthToken = newToken.appAuthToken;
          refreshTokenValue = newToken.refreshToken;
          await TenantModel.updateRefreshToken(
            tenant.id,
            encrypt(newToken.appAuthToken, ENCRYPTION_KEY),
            encrypt(newToken.refreshToken, ENCRYPTION_KEY),
            new Date(newToken.expiresAt)
          );
        }
      }

      // 2. 分页查询全部数据
      const allData = await queryDeviceMetricsAll(appAuthToken, yesterday, {
        onProgress: (current, total) => {
          if (current % 10000 === 0 || current === total) {
            logger.info('DATA_SYNC', `拉取进度: tenant=${tenant.name}, ${current}/${total}`);
          }
        },
        delayMs: 200,
      });

      if (allData.length === 0) {
        logger.info('DATA_SYNC', `无数据: tenant=${tenant.name}`);
        await SyncLogModel.update(logId, { status: 'success', total_records: 0, synced_records: 0, finished_at: new Date().toISOString() });
        await TenantModel.updateSyncStatus(tenant.id, 'success');
        results.push({ ...result, records: 0, duration: Date.now() - tenantStart });
        await sleep(300);
        continue;
      }

      // 3. 删除当天已有数据（幂等）
      await DeviceMetricsModel.deleteByTenantAndDate(tenant.id, yesterday);

      // 4. 映射并写入
      const mappedData = allData.map(item => mapDeviceData(tenant.id, yesterday, item));
      const insertedCount = await DeviceMetricsModel.batchInsert(mappedData);

      // 5. 更新设备数
      const deviceCount = await DeviceMetricsModel.getDeviceCountByTenantId(tenant.id);
      await TenantModel.updateDeviceCount(tenant.id, deviceCount);

      // 6. 记录同步结果
      await SyncLogModel.update(logId, {
        status: 'success',
        total_records: allData.length,
        synced_records: insertedCount,
        finished_at: new Date().toISOString(),
      });
      await TenantModel.updateSyncStatus(tenant.id, 'success');

      result.records = insertedCount;
      logger.info('DATA_SYNC', `同步成功: tenant=${tenant.name}, records=${insertedCount}`);
    } catch (err) {
      const error = err as Error;
      result.status = 'failed';
      result.error = error.message;

      await SyncLogModel.update(logId, {
        status: 'failed',
        error_message: error.message,
        finished_at: new Date().toISOString(),
      });
      await TenantModel.updateSyncStatus(tenant.id, 'failed', error.message);

      logger.error('DATA_SYNC', `同步失败: tenant=${tenant.name}`, error.message);
    }

    result.duration = Date.now() - tenantStart;
    results.push(result);

    // 租户间间隔，避免触发限流
    if (tenants.indexOf(tenant) < tenants.length - 1) {
      await sleep(500);
    }
  }

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'failed').length;
  const totalRecords = results.reduce((sum, r) => sum + r.records, 0);

  logger.info('DATA_SYNC', '========== 同步完成 ==========', {
    totalTenants: tenants.length,
    successCount,
    failCount,
    totalRecords,
    duration: `${Math.round(totalDuration / 1000)}s`,
    failures: results.filter(r => r.status === 'failed').map(r => ({ tenant: r.tenantName, error: r.error })),
  });

  return {
    success: failCount === 0,
    message: `同步完成: ${successCount}成功/${failCount}失败, 共${totalRecords}条记录, 耗时${Math.round(totalDuration / 1000)}秒`,
    results,
  };
};

// 本地测试
if (require.main === module) {
  handler().then(console.log).catch(console.error);
}
