import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Tag, Space, Tooltip, message, Popconfirm, Typography, Alert } from 'antd';
import {
  PlusOutlined, SearchOutlined, ExportOutlined, LinkOutlined, ReloadOutlined, EditOutlined, QrcodeOutlined
} from '@ant-design/icons';
import { adminApi } from '../../../api/request';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface Tenant {
  id: number;
  name: string;
  contact_name: string;
  contact_phone: string;
  authorization_status: string;
  last_sync_at: string;
  last_sync_status: string;
  device_count: number;
  status: number;
  created_at: string;
}

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待授权' },
  authorizing: { color: 'processing', text: '授权中' },
  authorized: { color: 'success', text: '已授权' },
  expired: { color: 'warning', text: '已过期' },
  disabled: { color: 'error', text: '已禁用' },
};

const syncStatusMap: Record<string, { color: string; text: string }> = {
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  syncing: { color: 'processing', text: '同步中' },
  never: { color: 'default', text: '未同步' },
};

const AdminTenants: React.FC = () => {
  const [data, setData] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  
  // 扫码授权 Modal
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanModalLoading, setScanModalLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [scanTenantId, setScanTenantId] = useState<number | null>(null);
  const [scanError, setScanError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getTenants({ page, pageSize: 20, keyword });
      setData(res.data.list);
      setTotal(res.data.total);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (values: { name: string; contact_name?: string; contact_phone?: string }) => {
    try {
      await adminApi.createTenant(values);
      message.success('租户创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      fetchData();
    } catch { /* handled */ }
  };

  const handleEdit = (record: Tenant) => {
    setEditingTenant(record);
    editForm.setFieldsValue({
      name: record.name,
      contact_name: record.contact_name,
      contact_phone: record.contact_phone,
    });
    setEditModalOpen(true);
  };

  const handleUpdate = async (values: { name: string; contact_name?: string; contact_phone?: string }) => {
    if (!editingTenant) return;
    try {
      await adminApi.updateTenant(editingTenant.id, values);
      message.success('租户信息已更新');
      setEditModalOpen(false);
      setEditingTenant(null);
      editForm.resetFields();
      fetchData();
    } catch { /* handled */ }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      await adminApi.updateTenantStatus(id, currentStatus === 1 ? 0 : 1);
      message.success(currentStatus === 1 ? '已禁用' : '已启用');
      fetchData();
    } catch { /* handled */ }
  };

  // 扫码授权
  const handleScanAuth = async (id: number) => {
    setScanTenantId(id);
    setScanError('');
    setScanModalOpen(true);
    setScanModalLoading(true);
    try {
      const res: any = await adminApi.getAuthQrCode(id);
      setQrCodeUrl(res.data.qrCodeUrl);
    } catch (err: any) {
      setScanError(err.message || '获取二维码失败');
    } finally {
      setScanModalLoading(false);
    }
  };

  // 网页授权（备用）
  const handleAuth = async (id: number) => {
    try {
      const res: any = await adminApi.getAuthQrCode(id);
      window.open(res.data.authUrl, '_blank');
    } catch { /* handled */ }
  };

  const handleSync = async (id: number) => {
    try {
      await adminApi.triggerSync(id);
      message.success('已触发同步');
      setTimeout(fetchData, 2000);
    } catch { /* handled */ }
  };

  const columns: ColumnsType<Tenant> = [
    {
      title: '租户名称', dataIndex: 'name', width: 150,
      render: (name) => <span style={{ color: '#fff', fontWeight: 500 }}>{name}</span>,
    },
    { title: '联系人', dataIndex: 'contact_name', width: 100 },
    { title: '联系电话', dataIndex: 'contact_phone', width: 130 },
    {
      title: '授权状态', dataIndex: 'authorization_status', width: 100,
      render: (status) => {
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '设备数', dataIndex: 'device_count', width: 80,
      sorter: (a, b) => a.device_count - b.device_count,
      render: (v) => <span style={{ color: '#4096FF' }}>{v}</span>,
    },
    {
      title: '同步状态', dataIndex: 'last_sync_status', width: 100,
      render: (status) => {
        const s = syncStatusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '最后同步', dataIndex: 'last_sync_at', width: 170,
      render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '启用状态', dataIndex: 'status', width: 80,
      render: (status) => <Tag color={status === 1 ? 'success' : 'error'}>{status === 1 ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑租户信息">
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          </Tooltip>
          {record.authorization_status !== 'authorized' && record.status === 1 && (
            <>
              <Tooltip title="扫码授权">
                <Button type="link" icon={<QrcodeOutlined />} onClick={() => handleScanAuth(record.id)}>扫码</Button>
              </Tooltip>
              <Tooltip title="网页授权">
                <Button type="link" icon={<LinkOutlined />} onClick={() => handleAuth(record.id)}>网页</Button>
              </Tooltip>
            </>
          )}
          {record.authorization_status === 'authorized' && (
            <Tooltip title="手动触发数据同步">
              <Button type="link" icon={<ReloadOutlined />} onClick={() => handleSync(record.id)}>同步</Button>
            </Tooltip>
          )}
          <Popconfirm
            title={record.status === 1 ? '确定禁用该租户？' : '确定启用该租户？'}
            onConfirm={() => handleToggleStatus(record.id, record.status)}
          >
            <Button type="link" danger={record.status === 1}>{record.status === 1 ? '禁用' : '启用'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>租户管理</Title>
        <Space>
          <Input
            placeholder="搜索租户名/联系人/电话"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 260 }}
            allowClear
            onClear={fetchData}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建租户
          </Button>
        </Space>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            showTotal: (t) => `共 ${t} 个租户`,
            showSizeChanger: false,
            onChange: setPage,
          }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </div>

      <Modal
        title="新建租户"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="租户名称" rules={[{ required: true, message: '请输入租户名称' }]}>
            <Input placeholder="请输入租户名称" />
          </Form.Item>
          <Form.Item name="contact_name" label="联系人">
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>
          <Form.Item name="contact_phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑租户"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingTenant(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="name" label="租户名称" rules={[{ required: true, message: '请输入租户名称' }]}>
            <Input placeholder="请输入租户名称" />
          </Form.Item>
          <Form.Item name="contact_name" label="联系人">
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>
          <Form.Item name="contact_phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 扫码授权 Modal */}
      <Modal
        title="支付宝扫码授权"
        open={scanModalOpen}
        onCancel={() => setScanModalOpen(false)}
        footer={null}
        width={400}
        centered
      >
        {scanError ? (
          <Alert type="error" message={scanError} showIcon />
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <p style={{ color: '#888', marginBottom: 16 }}>
                请使用支付宝APP扫描下方二维码完成授权
              </p>
              {scanModalLoading ? (
                <div style={{ width: 250, height: 250, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                  加载中...
                </div>
              ) : (
                <img 
                  src={qrCodeUrl} 
                  alt="授权二维码" 
                  style={{ width: 250, height: 250, display: 'block', margin: '0 auto' }} 
                />
              )}
            </div>
            <Alert
              type="info"
              message="二维码有效期5分钟，请在有效期内完成扫码授权"
              showIcon
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default AdminTenants;
