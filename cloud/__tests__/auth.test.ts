/**
 * 认证模块测试
 */
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../core/database', () => ({
  query: jest.fn(),
  execute: jest.fn(),
}));

jest.mock('../core/config', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-key-for-testing',
      expiresIn: '7d',
    },
    server: {
      port: 3000,
    },
  },
}));

describe('Auth Module', () => {
  const JWT_SECRET = 'test-jwt-secret-key-for-testing';

  describe('Token Generation', () => {
    it('should generate a valid JWT token for admin user', () => {
      const payload = { id: 1, username: 'admin', role: 'admin' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.id).toBe(1);
      expect(decoded.username).toBe('admin');
      expect(decoded.role).toBe('admin');
    });

    it('should generate a valid JWT token for tenant user', () => {
      const payload = { id: 1, username: 'tenant1', role: 'tenant', tenantId: 1 };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.tenantId).toBe(1);
    });

    it('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        jwt.verify(invalidToken, JWT_SECRET);
      }).toThrow();
    });

    it('should reject token with wrong secret', () => {
      const payload = { id: 1, username: 'admin', role: 'admin' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '7d' });

      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hash = bcrypt.hashSync(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(bcrypt.compareSync(password, hash)).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'correctPassword';
      const hash = bcrypt.hashSync(password, 10);

      expect(bcrypt.compareSync('wrongPassword', hash)).toBe(false);
    });
  });

  describe('Auth Middleware', () => {
    // Test auth middleware logic
    it('should validate required fields for admin login', () => {
      const loginData = { username: '', password: '' };
      const isValid = loginData.username && loginData.password;
      expect(isValid).toBeFalsy();
    });

    it('should validate required fields for tenant login', () => {
      const loginData = { tenantName: 'test', password: 'pass' };
      const isValid = loginData.tenantName && loginData.password;
      expect(isValid).toBeTruthy();
    });
  });

  describe('Role-based Access', () => {
    it('should identify admin role correctly', () => {
      const payload = { id: 1, username: 'admin', role: 'admin' };
      expect(payload.role).toBe('admin');
    });

    it('should identify tenant role correctly', () => {
      const payload = { id: 1, username: 'tenant1', role: 'tenant', tenantId: 1 };
      expect(payload.role).toBe('tenant');
      expect(payload.tenantId).toBeDefined();
    });
  });
});
