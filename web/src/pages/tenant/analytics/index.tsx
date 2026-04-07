import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Typography, DatePicker, Space, Radio, Spin, Empty } from 'antd';
import { tenantApi } from '../../../api/request';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend, PieChart, Pie,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface DailyData {
  metrics_date: string;
  device_count: string;
  alipay_amount: string;
  alipay_transaction_count: string;
  nfc_amount: string;
  nfc_transaction_count: string;
  online_count: string;
  checkin_count: string;
  refund_order_amt: string;
}

interface StoreData {
  store_id: string;
  store_name: string;
  total_amount: number;
  total_transactions: number;
  device_count: number;
  nfc_amount: number;
  nfc_transactions: number;
}

interface ProvinceData {
  province_name: string;
  province_code: string;
  total_amount: number;
  device_count: number;
}

const TenantAnalytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs().subtract(1, 'day')]);
  const [type, setType] = useState('daily');
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const [provinceData, setProvinceData] = useState<ProvinceData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const start = dateRange[0].format('YYYY-MM-DD');
    const end = dateRange[1].format('YYYY-MM-DD');
    try {
      const [dailyRes, storeRes, provinceRes] = await Promise.all([
        tenantApi.getAnalytics({ startDate: start, endDate: end, type: 'daily' }),
        tenantApi.getAnalytics({ startDate: start, endDate: end, type: 'store' }),
        tenantApi.getAnalytics({ startDate: start, endDate: end, type: 'province' }),
      ]);
      setDailyData((dailyRes as any).data || []);
      setStoreData((storeRes as any).data || []);
      setProvinceData((provinceRes as any).data || []);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />;

  const trendChart = dailyData.map(d => ({
    date: dayjs(d.metrics_date).format('MM-DD'),
    支付宝交易额: Number(d.alipay_amount) || 0,
    NFC交易额: Number(d.nfc_amount) || 0,
    退款金额: -(Number(d.refund_order_amt) || 0),
    支付宝笔数: Number(d.alipay_transaction_count) || 0,
  }));

  const storeRankChart = storeData.slice(0, 10).map(d => ({
    name: d.store_name || d.store_id || '未知',
    交易额: Number(d.total_amount) || 0,
    NFC占比: d.total_amount > 0 ? Math.round(Number(d.nfc_amount) / Number(d.total_amount) * 100) : 0,
  }));

  const COLORS = ['#1677FF', '#4096FF', '#52C41A', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2', '#EB2F96', '#FA8C16', '#69B1FF'];

  const provincePieData = provinceData.slice(0, 8).map(d => ({
    name: d.province_name || '未知',
    value: Number(d.total_amount) || 0,
  }));

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>图表分析</Title>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
          />
        </Space>
      </div>

      {dailyData.length === 0 ? (
        <Empty description="所选日期范围内暂无数据" />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={16}>
              <div className="glass-card" style={{ padding: 24 }}>
                <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>交易趋势</Title>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={trendChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                    <YAxis yAxisId="left" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="支付宝交易额" stroke="#1677FF" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="NFC交易额" stroke="#52C41A" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="退款金额" stroke="#FF4D4F" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line yAxisId="right" type="monotone" dataKey="支付宝笔数" stroke="#FAAD14" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Col>
            <Col span={8}>
              <div className="glass-card" style={{ padding: 24 }}>
                <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>省份交易分布</Title>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie data={provincePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                      {provincePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div className="glass-card" style={{ padding: 24 }}>
                <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>门店交易排行</Title>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={storeRankChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} width={80} />
                    <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                    <Bar dataKey="交易额" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {storeRankChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Col>
            <Col span={12}>
              <div className="glass-card" style={{ padding: 24 }}>
                <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>省份设备分布</Title>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={provinceData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="province_name" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                    <Bar dataKey="device_count" fill="#4096FF" name="设备数" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default TenantAnalytics;
