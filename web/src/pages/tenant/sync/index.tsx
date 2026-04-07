import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Button, Space, message } from 'antd';
import { ReloadOutlined, CloudSyncOutlined } from '@ant-design/icons';
import { tenantApi } from '../../../api/request';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface SyncLog {
  id: number;
  metrics_date: string;
  status: string;
  total_records: number;
  synced_records: number;
  error_message: string;
  started_at: string;
  finished_at: string;
  created_at: string;
}

const statusConfig: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '等待中' },
  running: { color: 'processing', text: '同步中' },
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  partial: { color: 'warning', text: '部分成功' },
};

const TenantSync: React.FC = () => {
  const [data, setData] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await tenantApi.getSyncLogs();
      setData(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSync = async () => {
    message.info('同步任务由系统管理员统一调度，如需手动同步请联系管理员');
  };

  const columns: ColumnsType<SyncLog> = [
    { title: '数据日期', dataIndex: 'metrics_date', width: 120 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (status) => {
        const cfg = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '记录数', width: 160,
      render: (_, r) => `${r.synced_records} / ${r.total_records}`,
    },
    {
      title: '耗时', width: 100,
      render: (_, r) => {
        if (!r.started_at || !r.finished_at) return '-';
        const ms = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}min`;
      },
    },
    {
      title: '错误信息', dataIndex: 'error_message', ellipsis: true,
      render: (msg) => msg ? <span style={{ color: '#FF4D4F' }}>{msg}</span> : '-',
    },
    {
      title: '时间', dataIndex: 'started_at', width: 170,
      render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>同步状态</Title>
        <Space>
          <Button type="primary" icon={<CloudSyncOutlined />} onClick={handleSync}>手动同步</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条记录` }}
          size="middle"
        />
      </div>
    </div>
  );
};

export default TenantSync;
