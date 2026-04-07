import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Result, Button, Card, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const AuthResult: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const status = searchParams.get('status');
  const message = searchParams.get('message');
  const tenantName = searchParams.get('tenantName');

  useEffect(() => {
    // 3秒后自动跳转到租户列表
    if (status === 'success') {
      const timer = setTimeout(() => {
        navigate('/admin/tenants', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  if (status === 'success') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Card style={{ width: 450, textAlign: 'center' }} bordered={false}>
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="授权成功"
            subTitle={
              <div>
                <p>{tenantName ? `${decodeURIComponent(tenantName)}` : '租户'}已成功完成支付宝授权</p>
                <Text type="secondary">页面将在3秒后自动跳转...</Text>
              </div>
            }
            extra={
              <Button type="primary" onClick={() => navigate('/admin/tenants')}>
                立即查看
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    }}>
      <Card style={{ width: 450, textAlign: 'center' }} bordered={false}>
        <Result
          icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
          title="授权失败"
          subTitle={
            <div>
              <p>{message ? decodeURIComponent(message) : '未知错误'}</p>
              <Text type="secondary">请返回租户管理页面重试</Text>
            </div>
          }
          extra={
            <Button type="primary" onClick={() => navigate('/admin/tenants')}>
              返回租户列表
            </Button>
          }
        />
      </Card>
    </div>
  );
};

export default AuthResult;
