import React, { useState, useEffect, useCallback } from 'react';
import { Table, Input, DatePicker, Button, Space, Tag, Typography, Select } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { tenantApi } from '../../../api/request';
import dayjs, { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface DeviceRecord {
  id: number;
  sn: string;
  store_id: string;
  binding_location: string;
  device_type: string;
  device_system: string;
  province_name: string;
  city_name: string;
  metrics_date: string;
  alipay_amount: number;
  alipay_transaction_count: number;
  nfc_amount: number;
  nfc_transaction_count: number;
  refund_order_amt: number;
  be_turnon_device: number;
  do_check_in: number;
  [key: string]: any;
}

const TenantDevices: React.FC = () => {
  const [data, setData] = useState<DeviceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sn, setSn] = useState('');
  const [storeId, setStoreId] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await tenantApi.getDevices({
        startDate: dateRange ? dateRange[0].format('YYYY-MM-DD') : dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        endDate: dateRange ? dateRange[1].format('YYYY-MM-DD') : dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        sn: sn || undefined,
        storeId: storeId || undefined,
        page,
        pageSize,
      });
      setData(res.data.list);
      setTotal(res.data.total);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }, [page, pageSize, sn, storeId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnsType<DeviceRecord> = [
    {
      title: '设备 SN', dataIndex: 'sn', width: 180, fixed: 'left',
      render: (v) => <span style={{ color: '#4096FF', fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '门店', width: 160,
      render: (_, r) => r.binding_location || r.store_id || '-',
    },
    { title: '设备类型', dataIndex: 'device_type', width: 120, ellipsis: true },
    {
      title: '支付宝交易额', dataIndex: 'alipay_amount', width: 130,
      sorter: (a, b) => a.alipay_amount - b.alipay_amount,
      render: (v) => <span style={{ color: '#52C41A' }}>¥{Number(v || 0).toFixed(2)}</span>,
    },
    {
      title: '支付宝笔数', dataIndex: 'alipay_transaction_count', width: 100,
      sorter: (a, b) => a.alipay_transaction_count - b.alipay_transaction_count,
    },
    {
      title: 'NFC 交易额', dataIndex: 'nfc_amount', width: 110,
      render: (v) => <span style={{ color: '#4096FF' }}>¥{Number(v || 0).toFixed(2)}</span>,
    },
    {
      title: 'NFC 笔数', dataIndex: 'nfc_transaction_count', width: 90,
    },
    {
      title: '退款金额', dataIndex: 'refund_order_amt', width: 110,
      render: (v) => <span style={{ color: v > 0 ? '#FF4D4F' : 'rgba(255,255,255,0.45)' }}>¥{Number(v || 0).toFixed(2)}</span>,
    },
    {
      title: '开机', dataIndex: 'be_turnon_device', width: 60,
      render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '签到', dataIndex: 'do_check_in', width: 60,
      render: (v) => <Tag color={v ? 'processing' : 'default'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '地区', width: 140,
      render: (_, r) => r.province_name && r.city_name ? `${r.province_name} ${r.city_name}` : '-',
    },
    {
      title: '统计日期', dataIndex: 'metrics_date', width: 110,
      render: (v) => dayjs(v).format('YYYY-MM-DD'),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <Title level={4} style={{ color: '#fff', marginBottom: 20 }}>设备数据</Title>

      {/* 筛选区 */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
            allowClear
            placeholder={['开始日期', '结束日期']}
          />
          <Input
            placeholder="设备 SN"
            prefix={<SearchOutlined />}
            value={sn}
            onChange={(e) => setSn(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 200 }}
            allowClear
            onClear={fetchData}
          />
          <Input
            placeholder="门店号"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 160 }}
            allowClear
            onClear={fetchData}
          />
          <Button type="primary" onClick={fetchData}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setSn(''); setStoreId(''); setDateRange(null); setPage(1); }}>重置</Button>
        </Space>
      </div>

      {/* 数据表格 */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(r) => `${r.sn}_${r.metrics_date}`}
          loading={loading}
          scroll={{ x: 1400 }}
          size="small"
          pagination={{
            current: page,
            total,
            pageSize,
            showTotal: (t) => `共 ${t} 条记录`,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </div>
    </div>
  );
};

export default TenantDevices;
