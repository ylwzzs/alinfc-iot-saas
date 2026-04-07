/**
 * 模块管理 - 业务逻辑层
 */
import { moduleRepository } from './repository';
import { cache } from '../../core/cache';
import { logger } from '../../core/logger';
import type { SystemModule, TenantModule } from './types';

export class ModuleService {
  private readonly CACHE_TTL = 300; // 5 分钟
  private initialized = false;

  /**
   * 获取所有系统模块
   */
  async getSystemModules(): Promise<SystemModule[]> {
    // 首次调用时初始化
    if (!this.initialized) {
      await moduleRepository.initSystemModules();
      this.initialized = true;
    }
    return moduleRepository.getSystemModules();
  }

  /**
   * 获取租户可用模块（带缓存）
   */
  async getTenantModules(tenantId: number): Promise<TenantModule[]> {
    const cacheKey = `tenant:${tenantId}:modules`;

    const cached = await cache.get<TenantModule[]>(cacheKey);
    if (cached) return cached;

    const modules = await moduleRepository.getTenantModules(tenantId);
    await cache.set(cacheKey, modules, this.CACHE_TTL);

    return modules;
  }

  /**
   * 检查租户是否有某个模块权限
   */
  async hasModule(tenantId: number, moduleId: string): Promise<boolean> {
    const modules = await this.getTenantModules(tenantId);
    return modules.some(m => m.module_id === moduleId && m.enabled);
  }

  /**
   * 为租户启用模块
   */
  async enableModule(
    tenantId: number,
    moduleId: string,
    config?: Record<string, unknown>,
    expiresAt?: Date
  ): Promise<void> {
    // 检查模块是否存在
    const sysModule = await moduleRepository.getSystemModuleById(moduleId);
    if (!sysModule) {
      throw new Error('模块不存在');
    }

    // 检查依赖模块
    if (sysModule.dependencies && sysModule.dependencies.length > 0) {
      for (const depId of sysModule.dependencies) {
        const hasDep = await this.hasModule(tenantId, depId);
        if (!hasDep) {
          throw new Error(`需要先启用依赖模块: ${depId}`);
        }
      }
    }

    await moduleRepository.enableModule(tenantId, moduleId, config, expiresAt);
    await this.invalidateCache(tenantId);

    logger.info('MODULE', `模块已启用`, { tenantId, moduleId });
  }

  /**
   * 为租户禁用模块
   */
  async disableModule(tenantId: number, moduleId: string): Promise<void> {
    // 检查是否是核心模块
    const sysModule = await moduleRepository.getSystemModuleById(moduleId);
    if (sysModule?.is_core) {
      throw new Error('核心模块不可禁用');
    }

    // 检查是否有其他模块依赖此模块
    const allModules = await this.getTenantModules(tenantId);
    for (const m of allModules) {
      const mod = await moduleRepository.getSystemModuleById(m.module_id);
      if (mod?.dependencies?.includes(moduleId) && m.enabled) {
        throw new Error(`模块 ${m.module_id} 依赖此模块，请先禁用`);
      }
    }

    await moduleRepository.disableModule(tenantId, moduleId);
    await this.invalidateCache(tenantId);

    logger.info('MODULE', `模块已禁用`, { tenantId, moduleId });
  }

  /**
   * 批量设置租户模块
   */
  async setTenantModules(
    tenantId: number,
    modules: { moduleId: string; enabled: boolean; config?: Record<string, unknown> }[]
  ): Promise<void> {
    await moduleRepository.setTenantModules(tenantId, modules);
    await this.invalidateCache(tenantId);

    logger.info('MODULE', `租户模块已批量更新`, { tenantId, count: modules.length });
  }

  /**
   * 初始化新租户的默认模块（启用核心模块）
   */
  async initTenantModules(tenantId: number): Promise<void> {
    const sysModules = await this.getSystemModules();

    for (const mod of sysModules) {
      if (mod.is_core) {
        await moduleRepository.enableModule(tenantId, mod.id);
      }
    }

    logger.info('MODULE', `新租户模块已初始化`, { tenantId });
  }

  /**
   * 清除缓存
   */
  private async invalidateCache(tenantId: number): Promise<void> {
    await cache.del(`tenant:${tenantId}:modules`);
  }
}

export const moduleService = new ModuleService();
