import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// 初始化 Sentry 错误追踪
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.MODE || 'development';

if (SENTRY_DSN && ENVIRONMENT === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // 性能监控采样率
    tracesSampleRate: 0.1,
    // 会话重放采样率
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // 忽略特定错误
    ignoreErrors: [
      'Network Error',
      'NetworkError',
      '请求超时',
      '登录已过期',
    ],
    // 版本信息
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);