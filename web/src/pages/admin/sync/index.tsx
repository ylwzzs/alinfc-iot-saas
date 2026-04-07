import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Button, Tooltip, Space } from 'antd';
import { ReloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { adminApi } from '../../../api/request';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface SyncLog {
  id: number;
  tenant_name: string;
  tenant_id: number;
  metrics_date: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
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

const AdminSync: React.FC = () => {
  const [data, setData] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getSyncLogs(100);
      setData(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const columns: ColumnsType<SyncLog> = [
    {
      title: '租户', dataIndex: 'tenant_name', width: 140,
      render: (name) => <span style={{ color: '#fff' }}>{name}</span>,
    },
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
      render: (_, record) => (
        <span>{record.synced_records} / {record.total_records}</span>
      ),
    },
    {
      title: '耗时', width: 100,
      render: (_, record) => {
        if (!record.started_at || !record.finished_at) return '-';
        const ms = new Date(record.finished_at).getTime() - new Date(record.started_at).getTime();
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}min`;
      },
    },
    {
      title: '错误信息', dataIndex: 'error_message', ellipsis: true, width: 200,
      render: (msg) => msg ? (
        <Tooltip title={msg}>
          <span style={{ color: '#FF4D4F' }}>{msg}</span>
        </Tooltip>
      ) : '-',
    },
    {
      title: '开始时间', dataIndex: 'started_at', width: 170,
      render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>同步状态</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条记录` }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </div>
    </div>
  );
};

export default AdminSync;
