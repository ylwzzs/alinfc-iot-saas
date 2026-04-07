/**
 * 导出模块 - 业务逻辑层
 */
import { db } from '../../core/database';
import { queue, type Task } from '../../core/queue';
import { logger } from '../../core/logger';
import { deviceRepository } from '../device/repository';
import type { ExportOptions, ExportRecord, ExportProgress } from './types';
import ExcelJS from 'exceljs';

export class ExportService {
  private readonly TASK_TYPE = 'export';

  /**
   * 初始化 - 注册任务处理器
   */
  init(): void {
    queue.register(this.TASK_TYPE, this.processExportTask.bind(this));
    logger.info('EXPORT', '导出任务处理器已注册');
  }

  /**
   * 创建导出任务
   */
  async createExport(options: ExportOptions): Promise<number> {
    // 创建导出记录
    const result = await db.execute(
      `INSERT INTO export_records (tenant_id, user_id, user_type, export_type, file_name, status, filter_config)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        options.tenantId,
        options.userId || null,
        options.userType,
        options.exportType,
        options.fileName,
        JSON.stringify(options.filterConfig),
      ]
    );

    const recordId = result.insertId;

    // 添加到任务队列
    await queue.add(this.TASK_TYPE, { recordId, options });

    logger.info('EXPORT', `导出任务已创建`, { recordId, options });
    return recordId;
  }

  /**
   * 处理导出任务
   */
  private async processExportTask(task: Task): Promise<void> {
    const { recordId, options } = task.payload as { recordId: number; options: ExportOptions };

    logger.info('EXPORT', `开始导出`, { recordId });

    try {
      // 更新状态为生成中
      await this.updateStatus(recordId, 'generating');

      // 查询数据
      const { list } = await deviceRepository.findByTenantAndDate(options.tenantId, {
        startDate: options.filterConfig.startDate,
        endDate: options.filterConfig.endDate,
        sn: options.filterConfig.sn,
        storeId: options.filterConfig.storeId,
        provinceCode: options.filterConfig.provinceCode,
        page: 1,
        pageSize: 100000, // 最大导出10万条
      });

      if (list.length === 0) {
        await this.updateStatus(recordId, 'failed', '没有符合条件的数据');
        return;
      }

      // 生成文件
      let filePath: string;
      let fileSize: number;

      if (options.exportType === 'excel') {
        const result = await this.generateExcel(options.fileName, list);
        filePath = result.path;
        fileSize = result.size;
      } else {
        const result = await this.generatePdf(options.fileName, list);
        filePath = result.path;
        fileSize = result.size;
      }

      // 更新记录
      await db.execute(
        `UPDATE export_records SET status = 'success', file_path = ?, file_size = ? WHERE id = ?`,
        [filePath, fileSize, recordId]
      );

      logger.info('EXPORT', `导出完成`, { recordId, filePath, fileSize });

    } catch (error) {
      const err = error as Error;
      await this.updateStatus(recordId, 'failed', err.message);
      logger.error('EXPORT', `导出失败`, { recordId, error: err.message });
      throw error;
    }
  }

  /**
   * 生成 Excel 文件
   */
  private async generateExcel(
    fileName: string,
    data: any[]
  ): Promise<{ path: string; size: number }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('设备数据');

    // 添加表头
    worksheet.columns = [
      { header: '日期', key: 'metrics_date', width: 12 },
      { header: '设备SN', key: 'sn', width: 20 },
      { header: '门店ID', key: 'store_id', width: 15 },
      { header: '门店名称', key: 'binding_location', width: 25 },
      { header: '省份', key: 'province_name', width: 10 },
      { header: '城市', key: 'city_name', width: 10 },
      { header: '支付宝金额', key: 'alipay_amount', width: 12 },
      { header: '支付宝笔数', key: 'alipay_transaction_count', width: 12 },
      { header: 'NFC金额', key: 'nfc_amount', width: 12 },
      { header: 'NFC笔数', key: 'nfc_transaction_count', width: 12 },
      { header: '退款金额', key: 'refund_order_amt', width: 12 },
    ];

    // 添加数据
    worksheet.addRows(data);

    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // 保存文件
    const filePath = `/tmp/${fileName}.xlsx`;
    await workbook.xlsx.writeFile(filePath);

    // 获取文件大小
    const fs = await import('fs');
    const stats = fs.statSync(filePath);

    return { path: filePath, size: stats.size };
  }

  /**
   * 生成 PDF 文件（简化版，实际可使用 pdfkit）
   */
  private async generatePdf(
    fileName: string,
    data: any[]
  ): Promise<{ path: string; size: number }> {
    // 简化处理，实际应使用 pdfkit 或其他库
    const filePath = `/tmp/${fileName}.pdf`;
    const fs = await import('fs');

    // 临时使用文本格式
    const content = data.map(row =>
      `${row.metrics_date}\t${row.sn}\t${row.alipay_amount}`
    ).join('\n');

    fs.writeFileSync(filePath, content);
    const stats = fs.statSync(filePath);

    return { path: filePath, size: stats.size };
  }

  /**
   * 更新导出状态
   */
  private async updateStatus(id: number, status: string, errorMessage?: string): Promise<void> {
    await db.execute(
      `UPDATE export_records SET status = ?, error_message = ? WHERE id = ?`,
      [status, errorMessage || null, id]
    );
  }

  /**
   * 获取导出进度
   */
  async getProgress(id: number): Promise<ExportProgress | null> {
    const rows = await db.query<any[]>(
      'SELECT * FROM export_records WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return null;

    const record = rows[0];
    return {
      id: record.id,
      status: record.status,
      progress: record.status === 'success' ? 100 : record.status === 'generating' ? 50 : 0,
      message: record.error_message,
      downloadUrl: record.status === 'success' ? `/api/export/download/${record.id}` : undefined,
    };
  }

  /**
   * 获取导出记录列表
   */
  async getRecords(tenantId: number, limit = 20): Promise<ExportRecord[]> {
    return db.query<any[]>(
      'SELECT * FROM export_records WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
      [tenantId, limit]
    );
  }

  /**
   * 获取导出文件
   */
  async getFilePath(id: number): Promise<string | null> {
    const rows = await db.query<any[]>(
      "SELECT file_path FROM export_records WHERE id = ? AND status = 'success'",
      [id]
    );
    return rows[0]?.file_path || null;
  }
}

export const exportService = new ExportService();
