import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Tabs, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, TeamOutlined } from '@ant-design/icons';
import { authApi } from '../../api/request';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const status = searchParams.get('status');
  const msg = searchParams.get('message');
  const tenantName = searchParams.get('tenantName');

  useEffect(() => {
    if (status === 'success') {
      message.success(`${tenantName || '租户'}授权成功！`);
    } else if (status === 'error') {
      message.error(`授权失败：${msg || '未知错误'}`);
    }
  }, [status, msg, tenantName]);

  const onAdminLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res: any = await authApi.adminLogin(values);
      setAuth(res.data.token, { ...res.data.user, role: 'admin' });
      message.success('登录成功');
      navigate('/admin');
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const onTenantLogin = async (values: { tenantName: string; password: string }) => {
    setLoading(true);
    try {
      const res: any = await authApi.tenantLogin({ tenantName: values.tenantName, password: values.password });
      setAuth(res.data.token, { id: res.data.tenant.id, username: res.data.tenant.name, role: 'tenant', tenantName: res.data.tenant.name });
      message.success('登录成功');
      navigate('/tenant');
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #001529 0%, #000C17 50%, #000000 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景装饰 */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '15%',
          width: 300,
          height: 300,
          background: 'radial-gradient(circle, rgba(22,119,255,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '10%',
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(22,119,255,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}
      />

      <Card
        style={{
          width: 420,
          background: 'rgba(20,20,20,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          position: 'relative',
          zIndex: 1,
        }}
        styles={{ body: { padding: '40px 36px' } }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #1677FF, #4096FF)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: '#fff',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(22,119,255,0.3)',
            }}
          >
            IoT
          </div>
          <Title level={3} style={{ color: '#fff', margin: 0, letterSpacing: '1px' }}>
            IoT Data SaaS
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, display: 'block', marginTop: 4 }}>
            支付宝 IoT 设备数据分析平台
          </Text>
        </div>

        <Tabs
          centered
          items={[
            {
              key: 'admin',
              label: '管理员登录',
              children: (
                <Form onFinish={onAdminLogin} size="large" layout="vertical">
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                    <Input prefix={<UserOutlined />} placeholder="管理员账号" style={{ height: 44, borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ height: 44, borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      style={{ height: 44, borderRadius: 8, fontWeight: 600, fontSize: 15 }}
                    >
                      登录管理后台
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'tenant',
              label: '租户登录',
              children: (
                <Form onFinish={onTenantLogin} size="large" layout="vertical">
                  <Form.Item name="tenantName" rules={[{ required: true, message: '请输入租户名称' }]}>
                    <Input prefix={<TeamOutlined />} placeholder="租户名称" style={{ height: 44, borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码（默认: 租户名+2024）" style={{ height: 44, borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      style={{ height: 44, borderRadius: 8, fontWeight: 600, fontSize: 15 }}
                    >
                      登录数据看板
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
            &copy; 2024 IoT Data SaaS. All rights reserved.
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;
