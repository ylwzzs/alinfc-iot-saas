/**
 * 模块管理页面
 * 管理员可控制租户的功能模块开关
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Switch,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Tabs,
  Descriptions,
  Badge,
} from 'antd';
import {
  AppstoreOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi, type SystemModule, type TenantModule, type Tenant } from '../../../api/request';

const ModuleManage: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [tenantModules, setTenantModules] = useState<Map<number, TenantModule[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configModule, setConfigModule] = useState<TenantModule | null>(null);
  const [configForm] = Form.useForm();

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, modulesRes] = await Promise.all([
        adminApi.getTenants({ pageSize: 100 }),
        adminApi.getModules(),
      ]);

      setTenants(tenantsRes.data?.list || []);
      setModules(modulesRes.data || []);

      // 加载每个租户的模块配置
      const modulesMap = new Map<number, TenantModule[]>();
      for (const tenant of tenantsRes.data?.list || []) {
        try {
          const res = await adminApi.getTenantModules(tenant.id);
          modulesMap.set(tenant.id, res.data || []);
        } catch {
          modulesMap.set(tenant.id, []);
        }
      }
      setTenantModules(modulesMap);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换模块状态
  const toggleModule = async (tenantId: number, moduleId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await adminApi.enableModule(tenantId, moduleId);
        message.success('模块已启用');
      } else {
        await adminApi.disableModule(tenantId, moduleId);
        message.success('模块已禁用');
      }
      loadData();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 打开配置弹窗
  const openConfigModal = (tenant: Tenant, module: TenantModule) => {
    setSelectedTenant(tenant);
    setConfigModule(module);
    configForm.setFieldsValue({
      expiresAt: module.expires_at ? dayjs(module.expires_at) : null,
    });
    setConfigModalVisible(true);
  };

  // 保存配置
  const saveConfig = async () => {
    if (!selectedTenant || !configModule) return;

    try {
      const values = await configForm.validateFields();
      await adminApi.enableModule(
        selectedTenant.id,
        configModule.module_id,
        configModule.config,
        values.expiresAt?.toISOString()
      );
      message.success('配置已保存');
      setConfigModalVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.message || '保存失败');
    }
  };

  // 获取模块状态标签
  const getModuleStatus = (moduleId: string, tenantId: number) => {
    const modules = tenantModules.get(tenantId) || [];
    const module = modules.find(m => m.module_id === moduleId);

    if (!module) {
      return <Tag>未配置</Tag>;
    }

    if (module.enabled) {
      if (module.expires_at && new Date(module.expires_at) < new Date()) {
        return <Tag color="warning">已过期</Tag>;
      }
      return <Tag color="success">已启用</Tag>;
    }

    return <Tag color="default">已禁用</Tag>;
  };

  // 获取模块信息
  const getModuleInfo = (moduleId: string) => {
    return modules.find(m => m.id === moduleId);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="模块管理" loading={loading}>
        <Tabs
          tabPosition="left"
          items={tenants.map(tenant => ({
            key: String(tenant.id),
            label: (
              <Space>
                <span>{tenant.name}</span>
                {tenant.authorization_status === 'authorized' ? (
                  <Badge status="success" />
                ) : (
                  <Badge status="default" />
                )}
              </Space>
            ),
            children: (
              <Table
                dataSource={modules}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: '模块名称',
                    dataIndex: 'name',
                    render: (name, record) => (
                      <Space>
                        <AppstoreOutlined />
                        <span>{name}</span>
                        {record.is_core && <Tag color="blue">核心</Tag>}
                      </Space>
                    ),
                  },
                  {
                    title: '描述',
                    dataIndex: 'description',
                  },
                  {
                    title: '版本',
                    dataIndex: 'version',
                    width: 80,
                  },
                  {
                    title: '状态',
                    key: 'status',
                    width: 100,
                    render: (_, record) => getModuleStatus(record.id, tenant.id),
                  },
                  {
                    title: '过期时间',
                    key: 'expiresAt',
                    width: 120,
                    render: (_, record) => {
                      const tenantMods = tenantModules.get(tenant.id) || [];
                      const mod = tenantMods.find(m => m.module_id === record.id);
                      if (mod?.expires_at) {
                        const expired = new Date(mod.expires_at) < new Date();
                        return (
                          <span style={{ color: expired ? '#ff4d4f' : undefined }}>
                            {dayjs(mod.expires_at).format('YYYY-MM-DD')}
                          </span>
                        );
                      }
                      return '-';
                    },
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 150,
                    render: (_, record) => {
                      if (record.is_core) {
                        return <Tag color="green">始终启用</Tag>;
                      }

                      const tenantMods = tenantModules.get(tenant.id) || [];
                      const mod = tenantMods.find(m => m.module_id === record.id);
                      const enabled = mod?.enabled ?? false;

                      return (
                        <Space>
                          <Switch
                            checked={enabled}
                            onChange={(checked) => toggleModule(tenant.id, record.id, checked)}
                            checkedChildren="开"
                            unCheckedChildren="关"
                          />
                          {enabled && (
                            <Button
                              type="text"
                              size="small"
                              icon={<SettingOutlined />}
                              onClick={() => openConfigModal(tenant, mod!)}
                            />
                          )}
                        </Space>
                      );
                    },
                  },
                ]}
              />
            ),
          }))}
        />
      </Card>

      {/* 配置弹窗 */}
      <Modal
        title="模块配置"
        open={configModalVisible}
        onOk={saveConfig}
        onCancel={() => setConfigModalVisible(false)}
      >
        <Form form={configForm} layout="vertical">
          <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="模块">{configModule?.name || configModule?.module_id}</Descriptions.Item>
            <Descriptions.Item label="租户">{selectedTenant?.name}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {configModule?.enabled ? (
                <Tag icon={<CheckCircleOutlined />} color="success">已启用</Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="default">已禁用</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Form.Item
            name="expiresAt"
            label="过期时间"
            extra="设置后模块将在指定时间后自动禁用（留空表示永久有效）"
          >
            <DatePicker style={{ width: '100%' }} showTime />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModuleManage;
