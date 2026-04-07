/**
 * 租户模块 - 业务逻辑层
 */
import { tenantRepository } from './repository';
import { cache } from '../../core/cache';
import { logger } from '../../core/logger';
import { db } from '../../core/database';
import type {
  Tenant,
  TenantCreateInput,
  TenantUpdateInput,
  TenantListOptions,
  TenantStats,
} from './types';

export class TenantService {
  private readonly CACHE_TTL = 300; // 5 分钟
  private readonly CACHE_PREFIX = 'tenant:';

  /**
   * 获取租户（带缓存）
   */
  async getById(id: number): Promise<Tenant | undefined> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;

    // 先查缓存
    const cached = await cache.get<Tenant>(cacheKey);
    if (cached) return cached;

    // 查数据库
    const tenant = await tenantRepository.findById(id);
    if (tenant) {
      await cache.set(cacheKey, tenant, this.CACHE_TTL);
    }

    return tenant;
  }

  /**
   * 根据名称获取租户
   */
  async getByName(name: string): Promise<Tenant | undefined> {
    return tenantRepository.findByName(name);
  }

  /**
   * 分页获取租户列表
   */
  async getList(options: TenantListOptions): Promise<{ list: Tenant[]; total: number }> {
    return tenantRepository.findAll(options);
  }

  /**
   * 获取已授权租户列表
   */
  async getAuthorized(): Promise<Tenant[]> {
    return tenantRepository.findAuthorized();
  }

  /**
   * 获取租户统计
   */
  async getStats(): Promise<TenantStats> {
    return tenantRepository.getStats();
  }

  /**
   * 创建租户
   */
  async create(data: TenantCreateInput): Promise<number> {
    // 检查名称是否已存在
    const existing = await tenantRepository.findByName(data.name);
    if (existing) {
      throw new Error('租户名称已存在');
    }

    const id = await tenantRepository.create(data);

    // 为租户创建分表
    await db.ensureTenantTable(id);

    logger.info('TENANT', `租户已创建: ${data.name}`, { id });
    return id;
  }

  /**
   * 更新租户
   */
  async update(id: number, data: TenantUpdateInput): Promise<void> {
    // 如果更新名称，检查是否重复
    if (data.name) {
      const existing = await tenantRepository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new Error('租户名称已存在');
      }
    }

    await tenantRepository.update(id, data);
    await this.invalidateCache(id);

    logger.info('TENANT', `租户已更新`, { id, updates: Object.keys(data) });
  }

  /**
   * 更新租户状态
   */
  async updateStatus(id: number, status: number): Promise<void> {
    await tenantRepository.updateStatus(id, status);
    await this.invalidateCache(id);

    logger.info('TENANT', `租户状态已更新`, { id, status });
  }

  /**
   * 更新授权状态
   */
  async updateAuthStatus(id: number, status: string, options?: { authorizedAt?: Date }): Promise<void> {
    await tenantRepository.updateAuthStatus(id, status as any, options);
    await this.invalidateCache(id);

    logger.info('TENANT', `租户授权状态已更新`, { id, status });
  }

  /**
   * 删除租户
   */
  async delete(id: number): Promise<void> {
    // 检查是否有数据
    const tenant = await tenantRepository.findById(id);
    if (!tenant) {
      throw new Error('租户不存在');
    }

    // TODO: 考虑是否需要清理分表数据

    await tenantRepository.delete(id);
    await this.invalidateCache(id);

    logger.info('TENANT', `租户已删除`, { id, name: tenant.name });
  }

  /**
   * 清除租户缓存
   */
  private async invalidateCache(id: number): Promise<void> {
    await cache.del(`${this.CACHE_PREFIX}${id}`);
    await cache.del(`${this.CACHE_PREFIX}${id}:modules`);
  }
}

export const tenantService = new TenantService();
