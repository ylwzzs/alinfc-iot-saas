// Jest setup file

// Extend timeout for integration tests
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.ENCRYPTION_KEY = 'test-32-char-encryption-k';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'alinfc_test';

// Suppress console.log in tests unless needed
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}

// Global test utilities
global.testUtils = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
