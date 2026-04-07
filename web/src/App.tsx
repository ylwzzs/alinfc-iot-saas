/**
 * 应用入口
 * 支持动态模块加载
 */
import React, { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, theme as antTheme, Spin, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import { useAuthStore, useHasModule } from './store';
import Login from './pages/login';
import AuthResult from './pages/auth/result';
import AdminLayout from './layouts/AdminLayout';
import TenantLayout from './layouts/TenantLayout';

// ============================================================
// 懒加载组件
// ============================================================

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

// 管理员页面
const AdminTenants = lazy(() => import('./pages/admin/tenants'));
const AdminOverview = lazy(() => import('./pages/admin/overview'));
const AdminSync = lazy(() => import('./pages/admin/sync'));
const AdminModules = lazy(() => import('./pages/admin/modules'));

// 租户页面
const TenantDashboard = lazy(() => import('./pages/tenant/dashboard'));
const TenantDevices = lazy(() => import('./pages/tenant/devices'));
const TenantAnalytics = lazy(() => import('./pages/tenant/analytics'));
const TenantExport = lazy(() => import('./pages/tenant/export'));
const TenantSync = lazy(() => import('./pages/tenant/sync'));

// ============================================================
// 路由守卫
// ============================================================

interface PrivateRouteProps {
  children: React.ReactNode;
  role?: 'admin' | 'tenant';
  moduleId?: string;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, role, moduleId }) => {
  const { token, user, isLoading, loadFromStorage } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    loadFromStorage();
  }, []);

  // 加载中
  if (isLoading) {
    return <PageLoader />;
  }

  // 未登录
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 角色检查
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/tenant'} replace />;
  }

  // 模块权限检查
  if (moduleId && !useHasModule(moduleId)) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <h2>功能未开通</h2>
        <p style={{ color: '#999' }}>当前租户未开通此功能模块，请联系管理员</p>
      </div>
    );
  }

  return <>{children}</>;
};

// ============================================================
// 模块路由组件
// ============================================================

interface ModuleRouteProps {
  moduleId: string;
  component: React.LazyExoticComponent<React.FC>;
  fallback?: React.ReactNode;
}

const ModuleRoute: React.FC<ModuleRouteProps> = ({ moduleId, component: Component, fallback }) => {
  const hasModule = useHasModule(moduleId);

  if (!hasModule) {
    return (
      fallback || (
        <div style={{ padding: 100, textAlign: 'center' }}>
          <h2>功能未开通</h2>
          <p style={{ color: '#999' }}>当前租户未开通此功能模块，请联系管理员</p>
        </div>
      )
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
};

// ============================================================
// 应用主题配置
// ============================================================

const themeConfig = {
  algorithm: antTheme.darkAlgorithm,
  token: {
    colorPrimary: '#1677FF',
    colorBgContainer: '#141414',
    colorBgElevated: '#1F1F1F',
    colorBorder: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
};

// ============================================================
// 应用组件
// ============================================================

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/result" element={<AuthResult />} />

      {/* 管理员路由 */}
      <Route
        path="/admin"
        element={
          <PrivateRoute role="admin">
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="tenants" replace />} />
        <Route
          path="tenants"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminTenants />
            </Suspense>
          }
        />
        <Route
          path="overview"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminOverview />
            </Suspense>
          }
        />
        <Route
          path="sync"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminSync />
            </Suspense>
          }
        />
        <Route
          path="modules"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminModules />
            </Suspense>
          }
        />
      </Route>

      {/* 租户路由 */}
      <Route
        path="/tenant"
        element={
          <PrivateRoute role="tenant">
            <TenantLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={<ModuleRoute moduleId="dashboard" component={TenantDashboard} />}
        />
        <Route
          path="devices"
          element={<ModuleRoute moduleId="devices" component={TenantDevices} />}
        />
        <Route
          path="analytics"
          element={<ModuleRoute moduleId="analytics" component={TenantAnalytics} />}
        />
        <Route
          path="export"
          element={<ModuleRoute moduleId="export" component={TenantExport} />}
        />
        <Route
          path="sync"
          element={<ModuleRoute moduleId="sync" component={TenantSync} />}
        />
      </Route>

      {/* 默认重定向 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntApp>
        <HashRouter>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
