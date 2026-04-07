import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Spin, Empty } from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, DesktopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { tenantApi } from '../../../api/request';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from 'recharts';
import dayjs from 'dayjs';

const { Title } = Typography;

interface DashboardData {
  dailySummary: {
    metrics_date: string; device_count: string; alipay_amount: string;
    alipay_transaction_count: string; nfc_amount: string; online_count: string;
    checkin_count: string;
  }[];
  storeRanking: { store_id: string; store_name: string; total_amount: number; device_count: number }[];
  provinceStats: { province_name: string; total_amount: number; device_count: number }[];
  yesterdaySummary: { device_count: string; alipay_amount: string; alipay_transaction_count: string };
}

const TenantDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res: any = await tenantApi.getDashboard();
        setData(res.data);
      } catch { /* handled */ } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />;
  if (!data) return <Empty description="暂无数据" style={{ marginTop: 100 }} />;

  const yd = data.yesterdaySummary;
  const formatAmount = (v: number) => `¥${(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

  const trendData = (data.dailySummary || []).map(item => ({
    date: dayjs(item.metrics_date).format('MM-DD'),
    交易额: Number(item.alipay_amount) || 0,
    NFC交易额: Number(item.nfc_amount) || 0,
    交易笔数: Number(item.alipay_transaction_count) || 0,
  }));

  const storeData = (data.storeRanking || []).map(item => ({
    name: item.store_name || item.store_id || '未知门店',
    交易额: Number(item.total_amount) || 0,
    设备数: Number(item.device_count) || 0,
  }));

  const provinceData = (data.provinceStats || []).map(item => ({
    name: item.province_name || '未知',
    交易额: Number(item.total_amount) || 0,
    设备数: Number(item.device_count) || 0,
  }));

  const dailyDeviceData = (data.dailySummary || []).slice(-7).map(item => ({
    date: dayjs(item.metrics_date).format('MM-DD'),
    在线设备: Number(item.online_count) || 0,
    签到设备: Number(item.checkin_count) || 0,
    总设备: Number(item.device_count) || 0,
  }));

  return (
    <div className="animate-fade-in-up">
      <Title level={4} style={{ color: '#fff', marginBottom: 24 }}>数据大屏</Title>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #1677FF, #4096FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarOutlined style={{ color: '#fff', fontSize: 20 }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>昨日交易额</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#52C41A' }}>{formatAmount(Number(yd?.alipay_amount || 0))}</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24, animationDelay: '0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #0958D9, #1677FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCartOutlined style={{ color: '#fff', fontSize: 20 }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>昨日交易笔数</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#4096FF' }}>{Number(yd?.alipay_transaction_count || 0).toLocaleString()}</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24, animationDelay: '0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #0E6655, #1ABC9C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DesktopOutlined style={{ color: '#fff', fontSize: 20 }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>昨日活跃设备</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1ABC9C' }}>{Number(yd?.device_count || 0).toLocaleString()}</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24, animationDelay: '0.45s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #E74C3C, #FF6B6B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircleOutlined style={{ color: '#fff', fontSize: 20 }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>设备在线率</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FF6B6B' }}>
              {Number(yd?.device_count || 0) > 0
                ? `${Math.round(Number(yd?.device_count || 0) / Math.max(Number(yd?.device_count || 1), 1) * 100)}%`
                : '0%'}
            </div>
          </div>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>近 30 天交易趋势</Title>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="交易额" stroke="#1677FF" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="NFC交易额" stroke="#52C41A" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="交易笔数" stroke="#FAAD14" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
        <Col span={8}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>近 7 天设备状态</Title>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyDeviceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="在线设备" stroke="#52C41A" strokeWidth={2} />
                <Line type="monotone" dataKey="签到设备" stroke="#1677FF" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>门店交易排行 TOP 10</Title>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={storeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} width={80} />
                <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                <Bar dataKey="交易额" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {storeData.map((_, i) => <Cell key={i} fill={['#1677FF', '#4096FF', '#69B1FF', '#91CAFF', '#BAE7FF', '#E6F4FF'][i % 6]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>
        <Col span={12}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>省份交易分布</Title>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={provinceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} />
                <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                <Bar dataKey="交易额" fill="#1677FF" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default TenantDashboard;
