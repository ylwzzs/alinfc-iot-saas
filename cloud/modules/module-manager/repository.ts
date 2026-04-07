/**
 * 模块管理 - 数据访问层
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../../core/database';
import { SystemModule, TenantModule, PRESET_MODULES } from './types';

export class ModuleRepository {
  /**
   * 获取所有系统模块
   */
  async getSystemModules(): Promise<SystemModule[]> {
    const rows = await db.query<RowDataPacket[] & SystemModule[]>(
      'SELECT * FROM system_modules WHERE status = ? ORDER BY is_core DESC, name ASC',
      ['active']
    );
    return rows;
  }

  /**
   * 获取系统模块 by ID
   */
  async getSystemModuleById(id: string): Promise<SystemModule | undefined> {
    return db.queryOne<RowDataPacket & SystemModule>(
      'SELECT * FROM system_modules WHERE id = ?',
      [id]
    );
  }

  /**
   * 获取租户已启用的模块
   */
  async getTenantModules(tenantId: number): Promise<TenantModule[]> {
    const rows = await db.query<RowDataPacket[] & TenantModule[]>(
      `SELECT tm.*, sm.name, sm.description, sm.route, sm.icon
       FROM tenant_modules tm
       JOIN system_modules sm ON tm.module_id = sm.id
       WHERE tm.tenant_id = ? AND tm.enabled = 1 AND sm.status = 'active'
       ORDER BY sm.is_core DESC, sm.name ASC`,
      [tenantId]
    );
    return rows;
  }

  /**
   * 获取租户模块配置
   */
  async getTenantModuleConfig(tenantId: number, moduleId: string): Promise<TenantModule | undefined> {
    return db.queryOne<RowDataPacket & TenantModule>(
      'SELECT * FROM tenant_modules WHERE tenant_id = ? AND module_id = ?',
      [tenantId, moduleId]
    );
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
    const existing = await this.getTenantModuleConfig(tenantId, moduleId);

    if (existing) {
      await db.execute(
        'UPDATE tenant_modules SET enabled = 1, config = ?, expires_at = ? WHERE id = ?',
        [JSON.stringify(config || {}), expiresAt || null, existing.id]
      );
    } else {
      await db.execute(
        'INSERT INTO tenant_modules (tenant_id, module_id, enabled, config, expires_at) VALUES (?, ?, 1, ?, ?)',
        [tenantId, moduleId, JSON.stringify(config || {}), expiresAt || null]
      );
    }
  }

  /**
   * 为租户禁用模块
   */
  async disableModule(tenantId: number, moduleId: string): Promise<void> {
    await db.execute(
      'UPDATE tenant_modules SET enabled = 0 WHERE tenant_id = ? AND module_id = ?',
      [tenantId, moduleId]
    );
  }

  /**
   * 批量设置租户模块
   */
  async setTenantModules(
    tenantId: number,
    modules: { moduleId: string; enabled: boolean; config?: Record<string, unknown> }[]
  ): Promise<void> {
    for (const m of modules) {
      if (m.enabled) {
        await this.enableModule(tenantId, m.moduleId, m.config);
      } else {
        await this.disableModule(tenantId, m.moduleId);
      }
    }
  }

  /**
   * 初始化系统模块表
   */
  async initSystemModules(): Promise<void> {
    for (const module of PRESET_MODULES) {
      const existing = await this.getSystemModuleById(module.id);
      if (!existing) {
        await db.execute(
          `INSERT INTO system_modules (id, name, description, version, icon, route, permissions, dependencies, is_core, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            module.id,
            module.name,
            module.description || null,
            module.version,
            module.icon || null,
            module.route || null,
            JSON.stringify(module.permissions),
            module.dependencies ? JSON.stringify(module.dependencies) : null,
            module.is_core ? 1 : 0,
            module.status,
          ]
        );
      }
    }
  }
}

export const moduleRepository = new ModuleRepository();
