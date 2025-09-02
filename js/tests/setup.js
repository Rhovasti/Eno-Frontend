/**
 * Jest test setup file for Eno Frontend
 * Configures global test environment and utilities
 */

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Create a mock request object
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  }),

  // Create a mock response object
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },

  // Create a mock next function
  mockNext: () => jest.fn(),

  // Sleep utility for async tests
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate test data
  generateTestUser: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    username: `testuser${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    roles: ['player'],
    is_admin: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  generateTestGame: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    name: `Test Game ${Date.now()}`,
    description: 'A test game for unit testing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),

  generateTestPost: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    beat_id: 1,
    author_id: 1,
    title: 'Test Post',
    content: 'This is a test post content',
    post_type: 'player',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
};

// Mock database operations for testing
global.mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    finalize: jest.fn(),
  })),
  close: jest.fn(),
  serialize: jest.fn((callback) => callback()),
};

// Mock AWS SDK for testing
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Location: 'https://test-bucket.s3.amazonaws.com/test-file.jpg'
      })
    }),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    })
  }))
}));

// Mock Anthropic SDK for testing
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'Mock AI response for testing' }]
      })
    }
  }))
}));

// Setup and teardown hooks
beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});

module.exports = {};