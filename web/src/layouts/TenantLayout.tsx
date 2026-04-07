/**
 * 租户端布局
 * 支持动态菜单（根据模块权限显示）
 */
import React, { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Space, Tag, Spin } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  ExportOutlined,
  SyncOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore, useModules } from '../store';

const { Sider, Header, Content } = Layout;

// 模块图标映射
const moduleIcons: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  devices: <UnorderedListOutlined />,
  analytics: <BarChartOutlined />,
  export: <ExportOutlined />,
  sync: <SyncOutlined />,
};

// 默认菜单配置（核心模块）
const defaultMenuItems = [
  { key: 'dashboard', path: '/tenant/dashboard', label: '数据大屏', isCore: true },
  { key: 'devices', path: '/tenant/devices', label: '设备数据', isCore: true },
  { key: 'sync', path: '/tenant/sync', label: '同步状态', isCore: true },
];

// 可选模块配置
const optionalModules = [
  { key: 'analytics', path: '/tenant/analytics', label: '图表分析', isCore: false },
  { key: 'export', path: '/tenant/export', label: '报表导出', isCore: false },
];

const TenantLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoading, hasModule } = useAuthStore();
  const modules = useModules();

  // 构建菜单项
  const menuItems = useMemo(() => {
    const items: Array<{ key: string; icon: React.ReactNode; label: string }> = [];

    // 核心模块始终显示
    defaultMenuItems.forEach(item => {
      items.push({
        key: item.path,
        icon: moduleIcons[item.key],
        label: item.label,
      });
    });

    // 可选模块根据权限显示
    optionalModules.forEach(item => {
      if (hasModule(item.key)) {
        items.push({
          key: item.path,
          icon: moduleIcons[item.key],
          label: item.label,
        });
      }
    });

    return items;
  }, [modules, hasModule]);

  const dropdownItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  // 当前菜单选中项
  const currentKey = '/' + location.pathname.split('/').slice(2).join('/');

  // 加载中
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000C17' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{
          background: '#000C17',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h1
            style={{
              color: '#1677FF',
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              letterSpacing: '1px',
            }}
          >
            IoT Data SaaS
          </h1>
        </div>

        {/* 导航菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', border: 'none', marginTop: 8 }}
          theme="dark"
        />

        {/* 模块数量提示 */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            padding: '0 16px',
            textAlign: 'center',
          }}
        >
          <Tag color="blue" style={{ margin: 0 }}>
            已开通 {modules.filter(m => m.enabled).length} 个模块
          </Tag>
        </div>
      </Sider>

      <Layout>
        {/* 头部 */}
        <Header
          style={{
            background: '#000C17',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <Space>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>当前租户:</span>
            <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
              {user?.username}
            </Tag>
          </Space>

          <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ background: '#1677FF' }} icon={<UserOutlined />} />
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{user?.username}</span>
            </Space>
          </Dropdown>
        </Header>

        {/* 内容区 */}
        <Content style={{ padding: 24, overflow: 'auto', background: '#000C17' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default TenantLayout;
