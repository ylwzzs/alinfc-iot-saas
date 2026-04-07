import React, { useState } from 'react';
import {
  Card, Typography, DatePicker, Button, Space, Radio, Select, message, Tag, Table,
  Progress, Statistic, Row, Col, Descriptions, Divider
} from 'antd';
import {
  DownloadOutlined, FileExcelOutlined, FilePdfOutlined, FileWordOutlined,
  TableOutlined, BarChartOutlined, CheckCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import { tenantApi } from '../../../api/request';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface ExportHistory {
  id: number;
  export_type: string;
  file_name: string;
  file_size: number;
  status: string;
  created_at: string;
}

// 导出类型
type ExportType = 'excel' | 'pdf' | 'word';
type ReportType = 'full' | 'summary' | 'device' | 'store';

const TenantExport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day'), dayjs().subtract(1, 'day')]);
  const [exportType, setExportType] = useState<ExportType>('excel');
  const [reportType, setReportType] = useState<ReportType>('full');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    try {
      // 获取设备数据
      setProgress(10);
      const res: any = await tenantApi.getDevices({
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        page: 1,
        pageSize: 10000,
      });

      setProgress(40);
      const data = res.data.list || [];
      if (data.length === 0) {
        message.warning('所选日期范围内没有数据');
        setExporting(false);
        return;
      }

      setProgress(60);

      // 根据报告类型生成不同格式
      switch (reportType) {
        case 'full':
          if (exportType === 'excel') {
            await exportFullExcel(data);
          } else if (exportType === 'pdf') {
            await exportFullPdf(data);
          } else {
            await exportFullWord(data);
          }
          break;
        case 'summary':
          await exportSummaryReport(data);
          break;
        case 'device':
          await exportDeviceReport(data);
          break;
        case 'store':
          await exportStoreReport(data);
          break;
      }

      setProgress(100);
    } catch (error: any) {
      message.error('导出失败: ' + (error.message || '未知错误'));
    } finally {
      setExporting(false);
    }
  };

  // 完整数据 Excel 导出
  const exportFullExcel = async (data: any[]) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '支付宝 IoT 数据分析系统';
    workbook.created = new Date();

    // Sheet 1: 设备明细
    const sheet = workbook.addWorksheet('设备明细数据');
    const headers = [
      '序号', '设备SN', '设备类型', '设备系统', '门店名称', '门店号',
      '省份', '城市', '区县', '详细地址',
      '支付宝交易额', '支付宝笔数', 'NFC交易额', 'NFC笔数',
      '退款金额', '退款笔数', '实际消费金额', '实际退款金额',
      '开机', '签到', '有效开机', '已注册', '已点亮', 'NFC交易',
      '近30天开机天数', '近30天签到天数', '近30天销售超2元天数',
      '近7天签到天数', '近30天有效开机天数',
      '绑定状态', '点亮时长(月)', '最近30天活跃用户数', '统计日期'
    ];

    sheet.columns = headers.map(h => ({
      header: h,
      key: h,
      width: h === '序号' ? 8 : h === '设备SN' ? 22 : 14
    }));

    // 表头样式
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1677FF' }
    };
    headerRow.height = 25;

    // 数据行
    data.forEach((row, index) => {
      const dataRow = sheet.addRow({
        '序号': index + 1,
        '设备SN': row.sn,
        '设备类型': row.device_type,
        '设备系统': row.device_system,
        '门店名称': row.binding_location,
        '门店号': row.store_id,
        '省份': row.province_name,
        '城市': row.city_name,
        '区县': row.district_name,
        '详细地址': row.location_address,
        '支付宝交易额': Number(row.alipay_amount || 0),
        '支付宝笔数': Number(row.alipay_transaction_count || 0),
        'NFC交易额': Number(row.nfc_amount || 0),
        'NFC笔数': Number(row.nfc_transaction_count || 0),
        '退款金额': Number(row.refund_order_amt || 0),
        '退款笔数': Number(row.refund_order_cnt || 0),
        '实际消费金额': Number(row.real_consume_fee || 0),
        '实际退款金额': Number(row.real_refund_fee || 0),
        '开机': row.be_turnon_device ? '是' : '否',
        '签到': row.do_check_in ? '是' : '否',
        '有效开机': row.effective_turnon_device ? '是' : '否',
        '已注册': row.be_register ? '是' : '否',
        '已点亮': row.be_lighted_up ? '是' : '否',
        'NFC交易': row.has_nfc_trade ? '是' : '否',
        '近30天开机天数': row.last_30_valid_boot_days || '0',
        '近30天签到天数': row.last_30_checkin_days || '0',
        '近30天销售超2元天数': row.last_30_sales_over_2_days || '0',
        '近7天签到天数': row.last_7_checkin_days || '0',
        '近30天有效开机天数': row.valid_open_days_last_bind_30_d || '0',
        '绑定状态': row.cur_bind_status,
        '点亮时长(月)': row.total_lighted_months || '0',
        '近30天活跃用户数': row.trd_nfc_device_usercnt || '0',
        '统计日期': dayjs(row.metrics_date).format('YYYY-MM-DD'),
      });

      // 斑马线样式
      if (index % 2 === 1) {
        dataRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
      }
    });

    // Sheet 2: 数据汇总
    const summarySheet = workbook.addWorksheet('数据汇总');
    const totalAmount = data.reduce((sum, r) => sum + Number(r.alipay_amount || 0), 0);
    const totalTx = data.reduce((sum, r) => sum + Number(r.alipay_transaction_count || 0), 0);
    const nfcAmount = data.reduce((sum, r) => sum + Number(r.nfc_amount || 0), 0);
    const nfcTx = data.reduce((sum, r) => sum + Number(r.nfc_transaction_count || 0), 0);
    const refundAmount = data.reduce((sum, r) => sum + Number(r.refund_order_amt || 0), 0);
    const onlineCount = data.filter(r => r.be_turnon_device).length;
    const registeredCount = data.filter(r => r.be_register).length;

    summarySheet.columns = [{ header: '指标', key: 'name', width: 25 }, { header: '数值', key: 'value', width: 20 }];

    summarySheet.addRow({ 'name': '报表生成时间', 'value': dayjs().format('YYYY-MM-DD HH:mm:ss') });
    summarySheet.addRow({ 'name': '统计周期', 'value': `${dateRange[0].format('YYYY-MM-DD')} ~ ${dateRange[1].format('YYYY-MM-DD')}` });
    summarySheet.addRow({ 'name': '数据总量', 'value': data.length });
    summarySheet.addRow({ 'name': '支付宝交易总额', 'value': `¥${totalAmount.toFixed(2)}` });
    summarySheet.addRow({ 'name': '支付宝交易总笔数', 'value': totalTx });
    summarySheet.addRow({ 'name': 'NFC交易总额', 'value': `¥${nfcAmount.toFixed(2)}` });
    summarySheet.addRow({ 'name': 'NFC交易总笔数', 'value': nfcTx });
    summarySheet.addRow({ 'name': '退款总金额', 'value': `¥${refundAmount.toFixed(2)}` });
    summarySheet.addRow({ 'name': '开机设备数', 'value': `${onlineCount} (${(onlineCount / data.length * 100).toFixed(1)}%)` });
    summarySheet.addRow({ 'name': '已注册设备数', 'value': `${registeredCount} (${(registeredCount / data.length * 100).toFixed(1)}%)` });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    downloadBlob(blob, `设备完整数据_${dateRange[0].format('YYYYMMDD')}-${dateRange[1].format('YYYYMMDD')}.xlsx`);
    message.success(`Excel 导出成功，共 ${data.length} 条记录`);
  };

  // 完整数据 PDF 导出（使用打印窗口）
  const exportFullPdf = async (data: any[]) => {
    const totalAmount = data.reduce((sum, r) => sum + Number(r.alipay_amount || 0), 0);
    const totalTx = data.reduce((sum, r) => sum + Number(r.alipay_transaction_count || 0), 0);
    const nfcAmount = data.reduce((sum, r) => sum + Number(r.nfc_amount || 0), 0);
    const onlineCount = data.filter(r => r.be_turnon_device).length;
    const registeredCount = data.filter(r => r.be_register).length;

    const summaryCards = [
      { label: '交易总额', value: `¥${totalAmount.toFixed(2)}`, color: '#1677ff', bg: '#e6f4ff' },
      { label: '交易总笔数', value: totalTx.toLocaleString(), color: '#52c41a', bg: '#f6ffed' },
      { label: 'NFC 交易额', value: `¥${nfcAmount.toFixed(2)}`, color: '#722ed1', bg: '#f9f0ff' },
      { label: '在线设备', value: `${onlineCount}/${data.length}`, color: '#faad14', bg: '#fffbe6' },
    ];

    const tableRows = data.slice(0, 150).map((r, i) => `
      <tr style="${i % 2 ? 'background:#fafafa' : ''}">
        <td style="padding:8px;text-align:center">${i + 1}</td>
        <td style="padding:8px;font-family:monospace;font-size:11px">${r.sn || '-'}</td>
        <td style="padding:8px">${r.binding_location || '-'}</td>
        <td style="padding:8px">${r.device_type || '-'}</td>
        <td style="padding:8px;text-align:right">¥${Number(r.alipay_amount || 0).toFixed(2)}</td>
        <td style="padding:8px;text-align:right">${r.alipay_transaction_count || 0}</td>
        <td style="padding:8px;text-align:right">¥${Number(r.nfc_amount || 0).toFixed(2)}</td>
        <td style="padding:8px;text-align:center">${r.be_turnon_device ? '✓' : '✗'}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IoT 设备数据报表</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #333;
      line-height: 1.5;
    }
    h1 {
      color: #1677ff;
      font-size: 24px;
      margin: 0 0 8px 0;
      text-align: center;
    }
    .header { text-align: center; margin-bottom: 20px; }
    .meta { color: #666; font-size: 13px; }
    .summary-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    .summary-card {
      flex: 1;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
    }
    .summary-card .value { font-size: 20px; font-weight: 700; }
    .summary-card .label { font-size: 12px; margin-top: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background: #1677ff;
      color: #fff;
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
    }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #999;
      font-size: 11px;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>IoT 设备数据报表</h1>
    <p class="meta">
      统计周期: ${dateRange[0].format('YYYY-MM-DD')} ~ ${dateRange[1].format('YYYY-MM-DD')} |
      共 ${data.length} 条记录 |
      导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
    </p>
  </div>

  <div class="summary-grid">
    ${summaryCards.map(card => `
      <div class="summary-card" style="background:${card.bg}">
        <div class="value" style="color:${card.color}">${card.value}</div>
        <div class="label">${card.label}</div>
      </div>
    `).join('')}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px;text-align:center">#</th>
        <th style="width:120px">设备 SN</th>
        <th>门店</th>
        <th style="width:100px">设备类型</th>
        <th style="width:80px;text-align:right">交易额</th>
        <th style="width:60px;text-align:right">笔数</th>
        <th style="width:80px;text-align:right">NFC交易额</th>
        <th style="width:50px;text-align:center">开机</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  ${data.length > 150 ? `
    <p style="color:#999;margin-top:16px;font-size:11px">
      注: PDF 仅展示前 150 条数据，完整数据请导出 Excel
    </p>
  ` : ''}

  <div class="footer">
    支付宝 IoT 数据分析 SaaS 系统 | ${dayjs().format('YYYY-MM-DD')}
  </div>
</body>
</html>`;

    openPrintWindow(html);
    message.success('PDF 报表已生成，请在打印窗口中选择"另存为 PDF"');
  };

  // Word 格式导出（HTML 格式，Word 可直接打开）
  const exportFullWord = async (data: any[]) => {
    const totalAmount = data.reduce((sum, r) => sum + Number(r.alipay_amount || 0), 0);
    const totalTx = data.reduce((sum, r) => sum + Number(r.alipay_transaction_count || 0), 0);

    const tableRows = data.slice(0, 500).map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.sn || '-'}</td>
        <td>${r.binding_location || '-'}</td>
        <td>${r.device_type || '-'}</td>
        <td style="text-align:right">¥${Number(r.alipay_amount || 0).toFixed(2)}</td>
        <td style="text-align:right">${r.alipay_transaction_count || 0}</td>
        <td>${dayjs(r.metrics_date).format('YYYY-MM-DD')}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>IoT 设备数据报表</title>
  <style>
    body { font-family: '微软雅黑', Arial, sans-serif; font-size: 12pt; }
    h1 { color: #1677ff; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #1677ff; color: white; padding: 8px; text-align: left; }
    td { padding: 6px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f5f5f5; }
    .summary { margin: 20px 0; }
    .summary-item { display: inline-block; margin-right: 30px; padding: 10px; background: #f0f5ff; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>IoT 设备数据报表</h1>
  <p style="text-align:center;color:#666">
    统计周期: ${dateRange[0].format('YYYY-MM-DD')} ~ ${dateRange[1].format('YYYY-MM-DD')} | 共 ${data.length} 条记录
  </p>

  <div class="summary">
    <div class="summary-item"><strong>交易总额:</strong> ¥${totalAmount.toFixed(2)}</div>
    <div class="summary-item"><strong>交易总笔数:</strong> ${totalTx.toLocaleString()}</div>
  </div>

  <table>
    <tr>
      <th>序号</th>
      <th>设备SN</th>
      <th>门店</th>
      <th>设备类型</th>
      <th>交易额</th>
      <th>交易笔数</th>
      <th>统计日期</th>
    </tr>
    ${tableRows}
  </table>

  <p style="margin-top:20px;color:#999;font-size:10pt">
    ${data.length > 500 ? '注: Word 文档仅展示前 500 条数据，完整数据请导出 Excel' : ''}
    <br>导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
  </p>
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    downloadBlob(blob, `设备数据_${dateRange[0].format('YYYYMMDD')}-${dateRange[1].format('YYYYMMDD')}.doc`);
    message.success('Word 报表导出成功');
  };

  // 汇总报告导出
  const exportSummaryReport = async (data: any[]) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('汇总分析');

    // 计算各项统计
    const totalAmount = data.reduce((sum, r) => sum + Number(r.alipay_amount || 0), 0);
    const totalTx = data.reduce((sum, r) => sum + Number(r.alipay_transaction_count || 0), 0);
    const nfcAmount = data.reduce((sum, r) => sum + Number(r.nfc_amount || 0), 0);
    const nfcTx = data.reduce((sum, r) => sum + Number(r.nfc_transaction_count || 0), 0);
    const refundAmount = data.reduce((sum, r) => sum + Number(r.refund_order_amt || 0), 0);
    const refundCount = data.reduce((sum, r) => sum + Number(r.refund_order_cnt || 0), 0);
    const onlineCount = data.filter(r => r.be_turnon_device).length;
    const registeredCount = data.filter(r => r.be_register).length;
    const signedCount = data.filter(r => r.do_check_in).length;
    const nfcTradeCount = data.filter(r => r.has_nfc_trade).length;

    // 省份分布
    const provinceStats: Record<string, { count: number; amount: number }> = {};
    data.forEach(r => {
      const province = r.province_name || '未知';
      if (!provinceStats[province]) {
        provinceStats[province] = { count: 0, amount: 0 };
      }
      provinceStats[province].count++;
      provinceStats[province].amount += Number(r.alipay_amount || 0);
    });

    // 设备类型分布
    const deviceTypeStats: Record<string, { count: number; amount: number }> = {};
    data.forEach(r => {
      const type = r.device_type || '未知';
      if (!deviceTypeStats[type]) {
        deviceTypeStats[type] = { count: 0, amount: 0 };
      }
      deviceTypeStats[type].count++;
      deviceTypeStats[type].amount += Number(r.alipay_amount || 0);
    });

    sheet.addRow(['IoT 设备数据分析汇总报告']);
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF1677FF' } };

    sheet.addRow([`统计周期: ${dateRange[0].format('YYYY-MM-DD')} ~ ${dateRange[1].format('YYYY-MM-DD')}`]);
    sheet.addRow([`生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`]);
    sheet.addRow([]);

    // 核心指标
    sheet.addRow(['一、核心指标']);
    sheet.getCell('A4').font = { bold: true };
    sheet.addRow(['指标', '数值', '说明']);
    sheet.addRow(['数据总量', data.length, '设备记录数']);
    sheet.addRow(['支付宝交易总额', `¥${totalAmount.toFixed(2)}`, '']);
    sheet.addRow(['支付宝交易总笔数', totalTx, '']);
    sheet.addRow(['NFC交易总额', `¥${nfcAmount.toFixed(2)}`, '']);
    sheet.addRow(['NFC交易总笔数', nfcTx, '']);
    sheet.addRow(['退款总金额', `¥${refundAmount.toFixed(2)}`, '']);
    sheet.addRow(['退款总笔数', refundCount, '']);
    sheet.addRow(['平均单笔交易', totalTx > 0 ? `¥${(totalAmount / totalTx).toFixed(2)}` : '¥0.00', '']);
    sheet.addRow([]);

    // 设备状态
    sheet.addRow(['二、设备状态统计']);
    sheet.getCell('A12').font = { bold: true };
    sheet.addRow(['状态', '数量', '占比']);
    sheet.addRow(['开机设备', onlineCount, `${(onlineCount / data.length * 100).toFixed(1)}%`]);
    sheet.addRow(['已注册设备', registeredCount, `${(registeredCount / data.length * 100).toFixed(1)}%`]);
    sheet.addRow(['签到设备', signedCount, `${(signedCount / data.length * 100).toFixed(1)}%`]);
    sheet.addRow(['NFC交易设备', nfcTradeCount, `${(nfcTradeCount / data.length * 100).toFixed(1)}%`]);
    sheet.addRow([]);

    // 省份分布
    sheet.addRow(['三、省份交易分布（Top 10）']);
    sheet.getCell('A19').font = { bold: true };
    sheet.addRow(['省份', '设备数', '交易额']);
    Object.entries(provinceStats)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 10)
      .forEach(([province, stats]) => {
        sheet.addRow([province, stats.count, `¥${stats.amount.toFixed(2)}`]);
      });
    sheet.addRow([]);

    // 设备类型分布
    sheet.addRow(['四、设备类型分布']);
    sheet.getCell(`A${sheet.rowCount + 1}`).font = { bold: true };
    sheet.addRow(['设备类型', '设备数', '交易额']);
    Object.entries(deviceTypeStats)
      .sort((a, b) => b[1].amount - a[1].amount)
      .forEach(([type, stats]) => {
        sheet.addRow([type, stats.count, `¥${stats.amount.toFixed(2)}`]);
      });

    sheet.columns.forEach(col => { col.width = 20; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    downloadBlob(blob, `数据汇总报告_${dateRange[0].format('YYYYMMDD')}-${dateRange[1].format('YYYYMMDD')}.xlsx`);
    message.success('汇总报告导出成功');
  };

  // 设备分析报告
  const exportDeviceReport = async (data: any[]) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('设备分析');

    sheet.addRow(['设备 SN 分析报告']);
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1677FF' } };

    sheet.addRow(['序号', '设备SN', '门店', '交易额', '交易笔数', '设备状态']);
    sheet.getRow(3).font = { bold: true };
    sheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // 按交易额排序
    const sortedData = [...data].sort((a, b) =>
      Number(b.alipay_amount || 0) - Number(a.alipay_amount || 0)
    ).slice(0, 200);

    sortedData.forEach((row, i) => {
      let status = '离线';
      if (row.be_turnon_device) status = '开机';
      if (row.do_check_in) status = '已签到';
      if (row.has_nfc_trade) status = '有交易';

      sheet.addRow([
        i + 1,
        row.sn,
        row.binding_location || '-',
        `¥${Number(row.alipay_amount || 0).toFixed(2)}`,
        row.alipay_transaction_count || 0,
        status
      ]);
    });

    sheet.columns.forEach(col => { col.width = 18; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    downloadBlob(blob, `设备分析报告_${dateRange[0].format('YYYYMMDD')}-${dateRange[1].format('YYYYMMDD')}.xlsx`);
    message.success('设备分析报告导出成功');
  };

  // 门店分析报告
  const exportStoreReport = async (data: any[]) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('门店分析');

    // 按门店聚合
    const storeStats: Record<string, any> = {};
    data.forEach(r => {
      const storeId = r.store_id || 'unknown';
      const storeName = r.binding_location || '未知门店';
      if (!storeStats[storeId]) {
        storeStats[storeId] = {
          name: storeName,
          count: 0,
          amount: 0,
          txCount: 0,
          nfcAmount: 0,
          nfcCount: 0,
          devices: new Set(),
        };
      }
      storeStats[storeId].count++;
      storeStats[storeId].amount += Number(r.alipay_amount || 0);
      storeStats[storeId].txCount += Number(r.alipay_transaction_count || 0);
      storeStats[storeId].nfcAmount += Number(r.nfc_amount || 0);
      storeStats[storeId].nfcCount += Number(r.nfc_transaction_count || 0);
      storeStats[storeId].devices.add(r.sn);
    });

    sheet.addRow(['门店交易分析报告']);
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1677FF' } };

    sheet.addRow(['序号', '门店名称', '门店号', '设备数', '交易总额', '交易笔数', 'NFC交易额']);
    sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };

    Object.entries(storeStats)
      .sort((a, b) => b[1].amount - a[1].amount)
      .forEach(([storeId, stats], i) => {
        sheet.addRow([
          i + 1,
          stats.name,
          storeId,
          stats.devices.size,
          `¥${stats.amount.toFixed(2)}`,
          stats.txCount,
          `¥${stats.nfcAmount.toFixed(2)}`,
        ]);
      });

    sheet.columns.forEach(col => { col.width = 16; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    downloadBlob(blob, `门店分析报告_${dateRange[0].format('YYYYMMDD')}-${dateRange[1].format('YYYYMMDD')}.xlsx`);
    message.success('门店分析报告导出成功');
  };

  // 辅助函数：下载 Blob
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 辅助函数：打开打印窗口
  const openPrintWindow = (html: string) => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  };

  return (
    <div className="animate-fade-in-up">
      <Title level={4} style={{ color: '#fff', marginBottom: 24 }}>
        <DownloadOutlined /> 报表导出
      </Title>

      {/* 导出配置 */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8 }}>
                选择日期范围
              </Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
                style={{ width: '100%' }}
                disabledDate={(current) => current && current > dayjs().subtract(1, 'day')}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8 }}>
                报告类型
              </Text>
              <Radio.Group
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="full"><TableOutlined /> 完整数据</Radio.Button>
                <Radio.Button value="summary"><BarChartOutlined /> 汇总分析</Radio.Button>
                <Radio.Button value="device">设备排名</Radio.Button>
                <Radio.Button value="store">门店分析</Radio.Button>
              </Radio.Group>
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8 }}>
                导出格式
              </Text>
              <Radio.Group
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="excel"><FileExcelOutlined /> Excel</Radio.Button>
                <Radio.Button value="pdf"><FilePdfOutlined /> PDF</Radio.Button>
                <Radio.Button value="word"><FileWordOutlined /> Word</Radio.Button>
              </Radio.Group>
            </div>

            {exporting && (
              <div style={{ marginBottom: 16 }}>
                <Progress percent={progress} status="active" />
              </div>
            )}

            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
              style={{ width: '100%', height: 48 }}
            >
              导出 {reportType === 'full' ? '完整数据' : reportType === 'summary' ? '汇总报告' : reportType === 'device' ? '设备排名' : '门店分析'}
            </Button>

            <div style={{ marginTop: 12 }}>
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
                {reportType === 'full' && exportType === 'excel' && '• Excel 最多导出 10,000 条记录，包含完整数据和工作表汇总'}
                {reportType === 'full' && exportType === 'pdf' && '• PDF 最多展示 150 条记录，适合打印和快速预览'}
                {reportType === 'full' && exportType === 'word' && '• Word 最多导出 500 条记录，适合文档编辑'}
                {reportType === 'summary' && '• 汇总报告包含核心指标、设备状态、省份分布、设备类型分布'}
                {reportType === 'device' && '• 设备排名按交易额排序，展示 Top 200 设备'}
                {reportType === 'store' && '• 门店分析按门店聚合统计，展示各门店交易情况'}
              </Text>
            </div>
          </Col>
        </Row>
      </div>

      {/* 导出格式说明 */}
      <div className="glass-card" style={{ padding: 24 }}>
        <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>导出格式说明</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card size="small" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <FileExcelOutlined style={{ fontSize: 24, color: '#52c41a', marginBottom: 8 }} />
              <Title level={5}>Excel 格式</Title>
              <Paragraph style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                推荐用于数据分析，支持多工作表、公式计算、数据透视
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f', marginBottom: 8 }} />
              <Title level={5}>PDF 格式</Title>
              <Paragraph style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                适合打印和归档，使用浏览器打印功能生成
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <FileWordOutlined style={{ fontSize: 24, color: '#1677ff', marginBottom: 8 }} />
              <Title level={5}>Word 格式</Title>
              <Paragraph style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                适合文档编辑，可直接用 Word 打开和修改
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default TenantExport;
