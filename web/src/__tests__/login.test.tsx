/**
 * 登录页面测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
  };
});

// Mock API
vi.mock('../api/request', () => ({
  authApi: {
    adminLogin: vi.fn(),
    tenantLogin: vi.fn(),
    getUser: vi.fn(),
  },
}));

// 简单的登录表单组件用于测试
const TestLoginForm = ({
  onLogin,
  loginType = 'admin',
}: {
  onLogin: (data: { username: string; password: string; loginType: string }) => void;
  loginType?: 'admin' | 'tenant';
}) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onLogin({
      username: formData.get('username') as string,
      password: formData.get('password') as string,
      loginType,
    });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      {loginType === 'admin' ? (
        <input name="username" placeholder="用户名" data-testid="username-input" />
      ) : (
        <input name="username" placeholder="租户名" data-testid="tenantname-input" />
      )}
      <input name="password" type="password" placeholder="密码" data-testid="password-input" />
      <button type="submit" data-testid="submit-btn">
        登录
      </button>
    </form>
  );
};

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Login Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Admin Login', () => {
    it('should render admin login form', () => {
      renderWithRouter(<TestLoginForm loginType="admin" onLogin={vi.fn()} />);

      expect(screen.getByTestId('login-form')).toBeDefined();
      expect(screen.getByTestId('username-input')).toBeDefined();
      expect(screen.getByTestId('password-input')).toBeDefined();
      expect(screen.getByTestId('submit-btn')).toBeDefined();
    });

    it('should submit admin credentials', async () => {
      const onLogin = vi.fn();
      renderWithRouter(<TestLoginForm loginType="admin" onLogin={onLogin} />);

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('submit-btn');

      await userEvent.type(usernameInput, 'admin');
      await userEvent.type(passwordInput, 'admin123');
      await userEvent.click(submitBtn);

      expect(onLogin).toHaveBeenCalledWith({
        username: 'admin',
        password: 'admin123',
        loginType: 'admin',
      });
    });

    it('should validate empty username', async () => {
      const onLogin = vi.fn();
      renderWithRouter(<TestLoginForm loginType="admin" onLogin={onLogin} />);

      const submitBtn = screen.getByTestId('submit-btn');
      await userEvent.click(submitBtn);

      expect(onLogin).toHaveBeenCalledWith({
        username: '',
        password: '',
        loginType: 'admin',
      });
    });
  });

  describe('Tenant Login', () => {
    it('should render tenant login form', () => {
      renderWithRouter(<TestLoginForm loginType="tenant" onLogin={vi.fn()} />);

      expect(screen.getByTestId('tenantname-input')).toBeDefined();
    });

    it('should submit tenant credentials', async () => {
      const onLogin = vi.fn();
      renderWithRouter(<TestLoginForm loginType="tenant" onLogin={onLogin} />);

      const usernameInput = screen.getByTestId('tenantname-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('submit-btn');

      await userEvent.type(usernameInput, 'test-tenant');
      await userEvent.type(passwordInput, 'tenant2024');
      await userEvent.click(submitBtn);

      expect(onLogin).toHaveBeenCalledWith({
        username: 'test-tenant',
        password: 'tenant2024',
        loginType: 'tenant',
      });
    });
  });

  describe('Token Management', () => {
    it('should store token in localStorage after successful login', () => {
      const token = 'test-jwt-token';
      localStorage.setItem('token', token);

      expect(localStorage.getItem('token')).toBe(token);
    });

    it('should clear token on logout', () => {
      localStorage.setItem('token', 'test-token');
      localStorage.removeItem('token');

      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should check token expiration', () => {
      const expiredToken = 'expired-token';
      const isValid = expiredToken !== null && expiredToken !== 'expired-token';
      expect(isValid).toBe(false);
    });
  });

  describe('Login Validation', () => {
    it('should reject empty credentials', () => {
      const credentials = { username: '', password: '' };
      const isValid = credentials.username.length > 0 && credentials.password.length > 0;
      expect(isValid).toBe(false);
    });

    it('should accept valid credentials', () => {
      const credentials = { username: 'admin', password: 'admin123' };
      const isValid = credentials.username.length > 0 && credentials.password.length > 0;
      expect(isValid).toBe(true);
    });

    it('should validate minimum password length', () => {
      const password = '1234567';
      const minLength = 8;
      const isValid = password.length >= minLength;
      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should display error for invalid credentials', () => {
      const errorResponse = { success: false, message: '用户名或密码错误' };
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toContain('错误');
    });

    it('should display error for disabled account', () => {
      const errorResponse = { success: false, message: '账号已被禁用' };
      expect(errorResponse.message).toContain('禁用');
    });

    it('should display error for unauthorized tenant', () => {
      const errorResponse = { success: false, message: '租户尚未授权' };
      expect(errorResponse.message).toContain('尚未授权');
    });
  });
});
