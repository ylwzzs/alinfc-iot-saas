import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin } from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, DesktopOutlined, DollarOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../../api/request';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import dayjs from 'dayjs';

const { Title } = Typography;

const COLORS = ['#1677FF', '#4096FF', '#69B1FF', '#91CAFF', '#BAE7FF', '#E6F4FF', '#1677FF', '#4096FF', '#69B1FF', '#91CAFF'];

interface OverviewData {
  tenantStats: { total: number; authorized: number; totalDevices: number };
  yesterdaySummary: { total_amount: number; total_transactions: number; device_count: number };
  dailySummary: { metrics_date: string; total_amount: number; total_transactions: number; device_count: number; tenant_count: number }[];
  tenantRanking: { name: string; total_amount: number; total_transactions: number; device_count: number }[];
}

const AdminOverview: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res: any = await adminApi.getOverview();
        setData(res.data);
      } catch { /* handled */ } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />;
  if (!data) return null;

  const formatAmount = (v: number) => `¥${(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

  const dailyChartData = data.dailySummary.map(item => ({
    date: dayjs(item.metrics_date).format('MM-DD'),
    交易额: Number(item.total_amount) || 0,
    交易笔数: Number(item.total_transactions) || 0,
    活跃设备: Number(item.device_count) || 0,
  }));

  const rankingData = data.tenantRanking.map(item => ({
    name: item.name,
    交易额: Number(item.total_amount) || 0,
    笔数: Number(item.total_transactions) || 0,
  }));

  return (
    <div className="animate-fade-in-up">
      <Title level={4} style={{ color: '#fff', marginBottom: 24 }}>数据概览</Title>

      {/* 核心指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24 }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>租户总数</span>} value={data.tenantStats.total} prefix={<TeamOutlined style={{ color: '#4096FF' }} />} valueStyle={{ color: '#fff', fontSize: 28 }} />
            <div style={{ marginTop: 8, color: '#52C41A', fontSize: 13 }}>
              已授权 {data.tenantStats.authorized} 个
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24, animationDelay: '0.2s' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>设备总数</span>} value={data.tenantStats.totalDevices} prefix={<DesktopOutlined style={{ color: '#4096FF' }} />} valueStyle={{ color: '#fff', fontSize: 28 }} />
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24, animationDelay: '0.4s' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>昨日交易额</span>} value={Number(data.yesterdaySummary.total_amount || 0)} prefix={<DollarOutlined style={{ color: '#52C41A' }} />} formatter={(v) => formatAmount(Number(v))} valueStyle={{ color: '#52C41A', fontSize: 28 }} />
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card stat-card-glow" style={{ padding: 24, animationDelay: '0.6s' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>昨日交易笔数</span>} value={Number(data.yesterdaySummary.total_transactions || 0)} prefix={<CheckCircleOutlined style={{ color: '#4096FF' }} />} valueStyle={{ color: '#fff', fontSize: 28 }} />
          </div>
        </Col>
      </Row>

      {/* 趋势图 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>近 30 天交易趋势</Title>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                <Line yAxisId="left" type="monotone" dataKey="交易额" stroke="#1677FF" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="交易笔数" stroke="#52C41A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
        <Col span={8}>
          <div className="glass-card" style={{ padding: 24 }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>租户交易 TOP 10</Title>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={rankingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} width={80} />
                <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                <Bar dataKey="交易额" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {rankingData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default AdminOverview;
