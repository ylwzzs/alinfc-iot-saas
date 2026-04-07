/**
 * 设备模块 - 业务逻辑层
 */
import { deviceRepository } from './repository';
import { tenantRepository } from '../tenant/repository';
import { cache } from '../../core/cache';
import { logger } from '../../core/logger';
import type { DeviceListOptions, DailySummary, StoreRanking, ProvinceStats } from './types';

export class DeviceService {
  private readonly CACHE_TTL = 60; // 1 分钟

  /**
   * 获取设备列表
   */
  async getDeviceList(tenantId: number, options: DeviceListOptions) {
    // 确保日期格式正确
    const startDate = options.startDate || this.getYesterday();
    const endDate = options.endDate || this.getYesterday();

    return deviceRepository.findByTenantAndDate(tenantId, {
      ...options,
      startDate,
      endDate,
    });
  }

  /**
   * 获取日汇总数据（带缓存）
   */
  async getDailySummary(tenantId: number, startDate: string, endDate: string): Promise<DailySummary[]> {
    const cacheKey = `tenant:${tenantId}:daily:${startDate}:${endDate}`;

    const cached = await cache.get<DailySummary[]>(cacheKey);
    if (cached) return cached;

    const data = await deviceRepository.getDailySummary(tenantId, startDate, endDate);
    await cache.set(cacheKey, data, this.CACHE_TTL);

    return data;
  }

  /**
   * 获取门店排行
   */
  async getStoreRanking(tenantId: number, startDate: string, endDate: string, limit = 10): Promise<StoreRanking[]> {
    const cacheKey = `tenant:${tenantId}:store:${startDate}:${endDate}:${limit}`;

    const cached = await cache.get<StoreRanking[]>(cacheKey);
    if (cached) return cached;

    const data = await deviceRepository.getStoreRanking(tenantId, startDate, endDate, limit);
    await cache.set(cacheKey, data, this.CACHE_TTL);

    return data;
  }

  /**
   * 获取省份统计
   */
  async getProvinceStats(tenantId: number, startDate: string, endDate: string): Promise<ProvinceStats[]> {
    const cacheKey = `tenant:${tenantId}:province:${startDate}:${endDate}`;

    const cached = await cache.get<ProvinceStats[]>(cacheKey);
    if (cached) return cached;

    const data = await deviceRepository.getProvinceStats(tenantId, startDate, endDate);
    await cache.set(cacheKey, data, this.CACHE_TTL);

    return data;
  }

  /**
   * 获取租户 Dashboard 数据
   */
  async getDashboard(tenantId: number, days = 30) {
    const { startDate, endDate, yesterday } = this.getDateRange(days);

    const [dailySummary, storeRanking, provinceStats, yesterdayData] = await Promise.all([
      this.getDailySummary(tenantId, startDate, endDate),
      this.getStoreRanking(tenantId, startDate, endDate, 10),
      this.getProvinceStats(tenantId, startDate, endDate),
      deviceRepository.getDailySummary(tenantId, yesterday, yesterday),
    ]);

    return {
      dailySummary,
      storeRanking,
      provinceStats,
      yesterdaySummary: yesterdayData[0] || {},
    };
  }

  /**
   * 获取设备数量
   */
  async getDeviceCount(tenantId: number): Promise<number> {
    const cacheKey = `tenant:${tenantId}:device_count`;

    const cached = await cache.get<number>(cacheKey);
    if (cached !== null) return cached;

    const count = await deviceRepository.getDeviceCount(tenantId);
    await cache.set(cacheKey, count, 300); // 缓存 5 分钟

    return count;
  }

  // ==================== 管理员接口 ====================

  /**
   * 获取全局概览
   */
  async getGlobalOverview(days = 30) {
    const { startDate, endDate, yesterday } = this.getDateRange(days);
    const tenantStats = await tenantRepository.getStats();

    // 注意：全局统计需要遍历所有租户分表或使用汇总表
    // 这里简化处理，实际生产环境应使用汇总表或定时任务预计算
    const dailySummary: DailySummary[] = [];
    const tenantRanking: any[] = [];

    return {
      tenantStats,
      dailySummary,
      tenantRanking,
      yesterdaySummary: { total_amount: 0, total_transactions: 0, device_count: 0 },
    };
  }

  // ==================== 工具方法 ====================

  private getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  private getDateRange(days: number): { startDate: string; endDate: string; yesterday: string } {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      yesterday: end.toISOString().split('T')[0],
    };
  }
}

export const deviceService = new DeviceService();
