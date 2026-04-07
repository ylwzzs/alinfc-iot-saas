import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Space, theme } from 'antd';
import {
  TeamOutlined,
  DashboardOutlined,
  SyncOutlined,
  LogoutOutlined,
  UserOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/admin/tenants', icon: <TeamOutlined />, label: '租户管理' },
  { key: '/admin/modules', icon: <AppstoreOutlined />, label: '模块管理' },
  { key: '/admin/overview', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/admin/sync', icon: <SyncOutlined />, label: '同步状态' },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { token: themeToken } = theme.useToken();

  const dropdownItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => { logout(); navigate('/login'); },
    },
  ];

  const currentKey = '/' + location.pathname.split('/').slice(2).join('/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{
          background: '#000C17',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h1 style={{ color: '#1677FF', fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '1px' }}>
            IoT Data SaaS
          </h1>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', border: 'none', marginTop: 8 }}
          theme="dark"
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#000C17',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            height: 64,
          }}
        >
          <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ background: '#1677FF' }} icon={<UserOutlined />} />
              <span style={{ color: '#fff' }}>{user?.realName || user?.username}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24, overflow: 'auto', background: '#000C17' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
