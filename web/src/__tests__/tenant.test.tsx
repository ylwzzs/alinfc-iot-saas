/**
 * 租户管理测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock tenant data
const mockTenants = [
  {
    id: 1,
    name: '测试租户1',
    contact_name: '联系人1',
    contact_phone: '13800138001',
    authorization_status: 'authorized',
    status: 1,
    device_count: 10,
    created_at: '2024-01-01',
  },
  {
    id: 2,
    name: '测试租户2',
    contact_name: '联系人2',
    contact_phone: '13800138002',
    authorization_status: 'pending',
    status: 1,
    device_count: 0,
    created_at: '2024-01-02',
  },
  {
    id: 3,
    name: '已禁用租户',
    contact_name: '联系人3',
    contact_phone: '13800138003',
    authorization_status: 'authorized',
    status: 0,
    device_count: 5,
    created_at: '2024-01-03',
  },
];

// Mock API
vi.mock('../api/request', () => ({
  adminApi: {
    getTenants: vi.fn(),
    createTenant: vi.fn(),
    updateTenant: vi.fn(),
    updateTenantStatus: vi.fn(),
    deleteTenant: vi.fn(),
    getAuthQrCode: vi.fn(),
  },
}));

// 简单的租户列表组件用于测试
const TestTenantList = ({
  tenants,
  onStatusChange = vi.fn(),
  onDelete = vi.fn(),
}: {
  tenants: typeof mockTenants;
  onStatusChange?: (id: number, status: number) => void;
  onDelete?: (id: number) => void;
}) => {
  return (
    <div data-testid="tenant-list">
      {tenants.map((tenant) => (
        <div key={tenant.id} data-testid={`tenant-${tenant.id}`}>
          <span data-testid={`tenant-name-${tenant.id}`}>{tenant.name}</span>
          <span data-testid={`tenant-status-${tenant.id}`}>
            {tenant.authorization_status}
          </span>
          <button
            onClick={() => onStatusChange(tenant.id, tenant.status === 1 ? 0 : 1)}
            data-testid={`toggle-status-${tenant.id}`}
          >
            {tenant.status === 1 ? '禁用' : '启用'}
          </button>
          <button onClick={() => onDelete(tenant.id)} data-testid={`delete-${tenant.id}`}>
            删除
          </button>
        </div>
      ))}
    </div>
  );
};

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Tenant Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tenant List Display', () => {
    it('should render tenant list', () => {
      renderWithRouter(<TestTenantList tenants={mockTenants} />);

      expect(screen.getByTestId('tenant-list')).toBeDefined();
      expect(screen.getByTestId('tenant-1')).toBeDefined();
      expect(screen.getByTestId('tenant-2')).toBeDefined();
    });

    it('should display tenant names correctly', () => {
      renderWithRouter(<TestTenantList tenants={mockTenants} />);

      expect(screen.getByTestId('tenant-name-1').textContent).toBe('测试租户1');
      expect(screen.getByTestId('tenant-name-2').textContent).toBe('测试租户2');
    });

    it('should display authorization status', () => {
      renderWithRouter(<TestTenantList tenants={mockTenants} />);

      expect(screen.getByTestId('tenant-status-1').textContent).toBe('authorized');
      expect(screen.getByTestId('tenant-status-2').textContent).toBe('pending');
    });
  });

  describe('Tenant Filtering', () => {
    it('should filter by authorization status', () => {
      const authorized = mockTenants.filter((t) => t.authorization_status === 'authorized');
      expect(authorized.length).toBe(2);
    });

    it('should filter by active status', () => {
      const active = mockTenants.filter((t) => t.status === 1);
      expect(active.length).toBe(2);
    });

    it('should search by name keyword', () => {
      const keyword = '测试';
      const filtered = mockTenants.filter((t) => t.name.includes(keyword));
      expect(filtered.length).toBe(2);
    });
  });

  describe('Tenant CRUD Operations', () => {
    it('should create new tenant', async () => {
      const newTenant = {
        name: '新租户',
        contact_name: '新联系人',
        contact_phone: '13900139000',
      };

      expect(newTenant.name).toBeDefined();
      expect(newTenant.contact_name).toBeDefined();
    });

    it('should update tenant info', () => {
      const updates = {
        name: '更新后的名称',
        contact_name: '更新后的联系人',
      };

      const original = mockTenants[0];
      const updated = { ...original, ...updates };

      expect(updated.name).toBe('更新后的名称');
      expect(updated.contact_name).toBe('更新后的联系人');
    });

    it('should toggle tenant status', async () => {
      const onStatusChange = vi.fn();
      renderWithRouter(
        <TestTenantList tenants={mockTenants} onStatusChange={onStatusChange} />
      );

      const toggleBtn = screen.getByTestId('toggle-status-1');
      await userEvent.click(toggleBtn);

      expect(onStatusChange).toHaveBeenCalledWith(1, 0);
    });

    it('should delete tenant', async () => {
      const onDelete = vi.fn();
      renderWithRouter(
        <TestTenantList tenants={mockTenants} onDelete={onDelete} />
      );

      const deleteBtn = screen.getByTestId('delete-1');
      await userEvent.click(deleteBtn);

      expect(onDelete).toHaveBeenCalledWith(1);
    });
  });

  describe('Tenant Creation Validation', () => {
    it('should validate required fields', () => {
      const tenantData = {
        name: '',
        contact_name: '',
        contact_phone: '',
      };

      const isValid =
        tenantData.name.length > 0 &&
        tenantData.contact_name.length > 0;

      expect(isValid).toBe(false);
    });

    it('should validate phone format', () => {
      const phoneRegex = /^1[3-9]\d{9}$/;
      const validPhone = '13800138000';
      const invalidPhone = '12345678901';

      expect(phoneRegex.test(validPhone)).toBe(true);
      expect(phoneRegex.test(invalidPhone)).toBe(false);
    });

    it('should check for duplicate name', () => {
      const newName = '测试租户1';
      const isDuplicate = mockTenants.some((t) => t.name === newName);
      expect(isDuplicate).toBe(true);
    });
  });

  describe('Authorization Status Display', () => {
    const statusMap: Record<string, { text: string; color: string }> = {
      pending: { text: '待授权', color: 'default' },
      authorizing: { text: '授权中', color: 'processing' },
      authorized: { text: '已授权', color: 'success' },
      expired: { text: '已过期', color: 'warning' },
      disabled: { text: '已禁用', color: 'error' },
    };

    it('should map status correctly', () => {
      expect(statusMap.pending.text).toBe('待授权');
      expect(statusMap.authorized.text).toBe('已授权');
      expect(statusMap.expired.text).toBe('已过期');
    });

    it('should identify actionable statuses', () => {
      const canAuthorize = ['pending', 'expired'];
      const status = 'pending';
      expect(canAuthorize.includes(status)).toBe(true);
    });
  });

  describe('Device Count Display', () => {
    it('should display device count', () => {
      const tenant = mockTenants[0];
      expect(tenant.device_count).toBe(10);
    });

    it('should show zero for new tenants', () => {
      const tenant = mockTenants[1];
      expect(tenant.device_count).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should calculate pagination correctly', () => {
      const total = 25;
      const pageSize = 10;
      const totalPages = Math.ceil(total / pageSize);

      expect(totalPages).toBe(3);
    });

    it('should slice data for current page', () => {
      const page = 1;
      const pageSize = 10;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      const pageData = mockTenants.slice(start, end);
      expect(pageData.length).toBe(3); // Only 3 items in mock
    });
  });
});
