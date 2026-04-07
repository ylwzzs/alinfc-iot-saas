/**
 * 同步模块 - 业务逻辑层
 * 支持断点续传、任务队列、批量写入
 */
import { syncRepository } from './repository';
import { tenantRepository } from '../tenant/repository';
import { deviceRepository } from '../device/repository';
import { queue, type Task } from '../../core/queue';
import { cache } from '../../core/cache';
import { logger } from '../../core/logger';
import { config } from '../../core/config';
import type { SyncCheckpoint, SyncProgress, AlipayDeviceMetric } from './types';

// 支付宝数据获取函数（从 alipay/data.ts 导入）
import { queryDeviceMetricsPage } from '../../shared/alipay/data';

export class SyncService {
  private readonly TASK_TYPE = 'sync';
  private readonly PAGE_SIZE = 1000;

  /**
   * 初始化 - 注册任务处理器
   */
  init(): void {
    queue.register(this.TASK_TYPE, this.processSyncTask.bind(this));
    logger.info('SYNC', '同步任务处理器已注册');
  }

  /**
   * 添加同步任务
   */
  async addSyncTask(tenantId: number, metricsDate: string, priority = 0): Promise<string> {
    // 检查租户是否已授权
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new Error('租户不存在');
    }
    if (tenant.authorization_status !== 'authorized') {
      throw new Error('租户未授权');
    }

    // 创建断点记录
    await syncRepository.createCheckpoint(tenantId, metricsDate);

    // 添加到任务队列
    const taskId = await queue.add(this.TASK_TYPE, { tenantId, metricsDate }, { priority });

    logger.info('SYNC', `同步任务已添加`, { tenantId, metricsDate, taskId });
    return taskId;
  }

  /**
   * 批量添加同步任务（所有租户）
   */
  async addSyncTasksForAllTenants(metricsDate: string): Promise<number> {
    const tenants = await tenantRepository.findAuthorized();
    let count = 0;

    for (const tenant of tenants) {
      try {
        await this.addSyncTask(tenant.id, metricsDate, tenant.device_count);
        count++;
      } catch (error) {
        logger.error('SYNC', `添加同步任务失败`, { tenantId: tenant.id, error: (error as Error).message });
      }
    }

    logger.info('SYNC', `批量同步任务已添加`, { count, total: tenants.length });
    return count;
  }

  /**
   * 处理同步任务（断点续传）
   */
  private async processSyncTask(task: Task): Promise<void> {
    const { tenantId, metricsDate } = task.payload as { tenantId: number; metricsDate: string };

    logger.info('SYNC', `开始同步`, { tenantId, metricsDate, taskId: task.id });

    try {
      // 获取租户信息
      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant || !tenant.app_auth_token) {
        throw new Error('租户不存在或未授权');
      }

      // 获取断点
      let checkpoint = await syncRepository.getCheckpoint(tenantId, metricsDate);
      if (!checkpoint) {
        await syncRepository.createCheckpoint(tenantId, metricsDate);
        checkpoint = await syncRepository.getCheckpoint(tenantId, metricsDate);
      }

      // 如果已完成，跳过
      if (checkpoint!.status === 'completed') {
        logger.info('SYNC', `同步已完成，跳过`, { tenantId, metricsDate });
        return;
      }

      // 从断点页开始同步
      let pageNum = checkpoint!.status === 'failed' ? checkpoint!.last_page + 1 : 1;
      let totalRecords = checkpoint!.total_records || 0;
      let syncedRecords = checkpoint!.synced_records || 0;

      // 获取第一页确定总数
      if (pageNum === 1) {
        const firstPage = await queryDeviceMetricsPage(
          tenant.app_auth_token,
          metricsDate,
          1,
          this.PAGE_SIZE
        );
        totalRecords = firstPage.count;
        const totalPages = Math.ceil(totalRecords / this.PAGE_SIZE);

        await syncRepository.updateCheckpoint(tenantId, metricsDate, {
          totalPages,
          totalRecords,
        });

        // 处理第一页数据
        if (firstPage.data.length > 0) {
          await this.saveMetrics(tenantId, metricsDate, firstPage.data as AlipayDeviceMetric[]);
          syncedRecords += firstPage.data.length;
        }

        await syncRepository.updateCheckpoint(tenantId, metricsDate, {
          lastPage: 1,
          syncedRecords,
        });

        pageNum = 2;
      }

      // 继续同步剩余页面
      const totalPages = Math.ceil(totalRecords / this.PAGE_SIZE);
      while (pageNum <= totalPages) {
        // 检查是否被中断（锁被释放）
        const lockToken = await cache.lock(`sync:${tenantId}:${metricsDate}`, 60);
        if (!lockToken) {
          logger.warn('SYNC', `同步任务被中断`, { tenantId, metricsDate, pageNum });
          return;
        }

        try {
          const pageData = await queryDeviceMetricsPage(
            tenant.app_auth_token,
            metricsDate,
            pageNum,
            this.PAGE_SIZE
          );

          if (pageData.data.length > 0) {
            await this.saveMetrics(tenantId, metricsDate, pageData.data as AlipayDeviceMetric[]);
            syncedRecords += pageData.data.length;
          }

          // 更新断点
          await syncRepository.updateCheckpoint(tenantId, metricsDate, {
            lastPage: pageNum,
            syncedRecords,
          });

          logger.debug('SYNC', `页面同步完成`, {
            tenantId,
            metricsDate,
            pageNum,
            totalPages,
            syncedRecords,
          });

          pageNum++;

          // 延迟，避免接口限流
          await this.sleep(config.sync.delayMs);

        } finally {
          await cache.unlock(`sync:${tenantId}:${metricsDate}`, lockToken);
        }
      }

      // 同步完成
      await syncRepository.updateCheckpoint(tenantId, metricsDate, {
        status: 'completed',
        syncedRecords,
      });

      // 更新租户同步状态
      await tenantRepository.updateSyncStatus(tenantId, 'success');

      // 更新设备数量
      const deviceCount = await deviceRepository.getDeviceCount(tenantId);
      await tenantRepository.updateDeviceCount(tenantId, deviceCount);

      logger.info('SYNC', `同步完成`, { tenantId, metricsDate, syncedRecords, totalRecords });

    } catch (error) {
      const err = error as Error;

      // 更新断点状态
      await syncRepository.updateCheckpoint(tenantId, metricsDate, {
        status: 'failed',
        errorMessage: err.message,
      });

      await tenantRepository.updateSyncStatus(tenantId, 'failed', err.message);

      logger.error('SYNC', `同步失败`, { tenantId, metricsDate, error: err.message });

      throw error;
    }
  }

  /**
   * 保存指标数据（批量写入）
   */
  private async saveMetrics(
    tenantId: number,
    metricsDate: string,
    data: AlipayDeviceMetric[]
  ): Promise<void> {
    const records = data.map(item => this.transformMetric(tenantId, metricsDate, item));
    await deviceRepository.batchInsert(tenantId, records);
  }

  /**
   * 转换支付宝数据格式
   */
  private transformMetric(
    tenantId: number,
    metricsDate: string,
    item: AlipayDeviceMetric
  ): Record<string, unknown> {
    return {
      tenant_id: tenantId,
      metrics_date: metricsDate,
      sn: item.sn,
      store_id: item.store_id,
      device_type: item.device_type,
      device_system: item.device_system,
      province_code: item.province_code,
      province_name: item.province_name,
      city_code: item.city_code,
      city_name: item.city_name,
      district_code: item.district_code,
      district_name: item.district_name,
      location_address: item.location_address,
      binding_location: item.binding_location,
      alipay_amount: this.parseNumber(item.alipay_amt),
      alipay_transaction_count: this.parseNumber(item.alipay_trd_cnt),
      effective_alipay_transaction_count: this.parseNumber(item.eff_alipay_trd_cnt),
      nfc_amount: this.parseNumber(item.nfc_amt),
      nfc_transaction_count: this.parseNumber(item.nfc_trd_cnt),
      effective_nfc_transaction_count: this.parseNumber(item.eff_nfc_trd_cnt),
      refund_order_amt: this.parseNumber(item.refund_order_amt),
      refund_order_cnt: this.parseNumber(item.refund_order_cnt),
      real_refund_fee: this.parseNumber(item.real_refund_fee),
      real_consume_fee: this.parseNumber(item.real_consume_fee),
      be_register: item.be_register || 0,
      register_time: item.register_time,
      be_lighted_up: item.be_lighted_up || 0,
      light_up_time: item.light_up_time,
      be_turnon_device: item.be_turnon_device || 0,
      effective_turnon_device: item.eff_turnon_device || 0,
      do_check_in: item.do_check_in || 0,
      last_30_valid_boot_days: item.last_30_valid_boot_days || '0',
      last_30_sales_over_2_days: item.last_30_sales_over_2_days || '0',
      last_30_checkin_days: item.last_30_checkin_days || '0',
      last_7_checkin_days: item.last_7_checkin_days || '0',
      cont_non_turnon_days_mtd: item.cont_non_turnon_days_mtd || '0',
      total_lighted_months: item.total_lighted_months || '0',
      raw_data: item,
      synced_at: new Date(),
    };
  }

  private parseNumber(value: string | number | undefined): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== 查询接口 ====================

  /**
   * 获取同步进度
   */
  async getProgress(tenantId: number, metricsDate: string): Promise<SyncProgress | null> {
    const checkpoint = await syncRepository.getCheckpoint(tenantId, metricsDate);
    if (!checkpoint) return null;

    const percent = checkpoint.total_records > 0
      ? Math.round((checkpoint.synced_records / checkpoint.total_records) * 100)
      : 0;

    return {
      tenantId: checkpoint.tenant_id,
      metricsDate: checkpoint.metrics_date,
      currentPage: checkpoint.last_page,
      totalPages: checkpoint.total_pages,
      syncedRecords: checkpoint.synced_records,
      totalRecords: checkpoint.total_records,
      status: checkpoint.status,
      percent,
    };
  }

  /**
   * 获取租户同步日志
   */
  async getSyncLogs(tenantId: number, limit = 30) {
    return syncRepository.getSyncLogsByTenant(tenantId, limit);
  }

  /**
   * 获取最近同步日志（管理员）
   */
  async getRecentSyncLogs(limit = 50) {
    return syncRepository.getRecentSyncLogs(limit);
  }

  /**
   * 重试失败的同步
   */
  async retryFailed(tenantId: number, metricsDate: string): Promise<string> {
    const checkpoint = await syncRepository.getCheckpoint(tenantId, metricsDate);
    if (!checkpoint || checkpoint.status !== 'failed') {
      throw new Error('没有失败的同步任务');
    }

    return this.addSyncTask(tenantId, metricsDate);
  }
}

export const syncService = new SyncService();
