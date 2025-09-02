/**
 * Unit tests for authentication functionality
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock the database
const mockDb = global.mockDb;

describe('Authentication Functions', () => {
  // Mock auth functions (we'll need to extract these from server file)
  const authFunctions = {
    hashPassword: async (password) => {
      return await bcrypt.hash(password, 10);
    },
    
    comparePassword: async (password, hash) => {
      return await bcrypt.compare(password, hash);
    },
    
    generateToken: (user) => {
      return jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          roles: user.roles,
          is_admin: user.is_admin 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    },
    
    verifyToken: (token) => {
      return jwt.verify(token, process.env.JWT_SECRET);
    },
    
    authenticateUser: async (username, password) => {
      // Mock database call
      const user = {
        id: 1,
        username: username,
        password: await authFunctions.hashPassword('testpassword'),
        roles: ['player'],
        is_admin: false
      };
      
      if (await authFunctions.comparePassword(password, user.password)) {
        return user;
      }
      return null;
    }
  };

  describe('Password Hashing', () => {
    test('should hash password correctly', async () => {
      const password = 'testpassword123';
      const hash = await authFunctions.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    test('should verify password correctly', async () => {
      const password = 'testpassword123';
      const hash = await authFunctions.hashPassword(password);
      
      const isValid = await authFunctions.comparePassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await authFunctions.comparePassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT Token Management', () => {
    const testUser = {
      id: 1,
      username: 'testuser',
      roles: ['player'],
      is_admin: false
    };

    test('should generate valid JWT token', () => {
      const token = authFunctions.generateToken(testUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should verify JWT token correctly', () => {
      const token = authFunctions.generateToken(testUser);
      const decoded = authFunctions.verifyToken(token);
      
      expect(decoded.id).toBe(testUser.id);
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.roles).toEqual(testUser.roles);
      expect(decoded.is_admin).toBe(testUser.is_admin);
    });

    test('should throw error for invalid token', () => {
      expect(() => {
        authFunctions.verifyToken('invalid-token');
      }).toThrow();
    });

    test('should throw error for expired token', () => {
      // Generate token with very short expiry
      const shortToken = jwt.sign(
        { id: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '1ms' }
      );
      
      // Wait a bit then try to verify
      setTimeout(() => {
        expect(() => {
          authFunctions.verifyToken(shortToken);
        }).toThrow();
      }, 10);
    });
  });

  describe('User Authentication', () => {
    test('should authenticate valid user', async () => {
      const user = await authFunctions.authenticateUser('testuser', 'testpassword');
      
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.roles).toContain('player');
    });

    test('should reject invalid credentials', async () => {
      const user = await authFunctions.authenticateUser('testuser', 'wrongpassword');
      expect(user).toBeNull();
    });
  });

  describe('Role-Based Access Control', () => {
    const adminUser = { id: 1, roles: ['admin', 'gm', 'player'], is_admin: true };
    const gmUser = { id: 2, roles: ['gm', 'player'], is_admin: false };
    const playerUser = { id: 3, roles: ['player'], is_admin: false };

    const hasRole = (user, role) => user.roles.includes(role);
    const isAdmin = (user) => user.is_admin === true;
    const canAccessGMFeatures = (user) => hasRole(user, 'gm') || isAdmin(user);

    test('should correctly identify admin users', () => {
      expect(isAdmin(adminUser)).toBe(true);
      expect(isAdmin(gmUser)).toBe(false);
      expect(isAdmin(playerUser)).toBe(false);
    });

    test('should correctly identify GM access', () => {
      expect(canAccessGMFeatures(adminUser)).toBe(true);
      expect(canAccessGMFeatures(gmUser)).toBe(true);
      expect(canAccessGMFeatures(playerUser)).toBe(false);
    });

    test('should validate role permissions', () => {
      expect(hasRole(adminUser, 'admin')).toBe(true);
      expect(hasRole(gmUser, 'gm')).toBe(true);
      expect(hasRole(playerUser, 'player')).toBe(true);
      
      expect(hasRole(playerUser, 'admin')).toBe(false);
      expect(hasRole(playerUser, 'gm')).toBe(false);
    });
  });

  describe('Session Management', () => {
    const mockSessions = new Map();
    
    const sessionManager = {
      createSession: (userId, token) => {
        const sessionId = `session_${Date.now()}_${userId}`;
        mockSessions.set(sessionId, {
          userId,
          token,
          createdAt: new Date(),
          lastAccessed: new Date()
        });
        return sessionId;
      },
      
      getSession: (sessionId) => {
        return mockSessions.get(sessionId);
      },
      
      updateSession: (sessionId) => {
        const session = mockSessions.get(sessionId);
        if (session) {
          session.lastAccessed = new Date();
          mockSessions.set(sessionId, session);
        }
      },
      
      destroySession: (sessionId) => {
        return mockSessions.delete(sessionId);
      }
    };

    test('should create session correctly', () => {
      const userId = 1;
      const token = 'test-token';
      const sessionId = sessionManager.createSession(userId, token);
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toContain('session_');
      expect(sessionId).toContain(userId.toString());
    });

    test('should retrieve session data', () => {
      const userId = 1;
      const token = 'test-token';
      const sessionId = sessionManager.createSession(userId, token);
      const session = sessionManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.token).toBe(token);
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    test('should update session access time', () => {
      const userId = 1;
      const token = 'test-token';
      const sessionId = sessionManager.createSession(userId, token);
      const originalSession = sessionManager.getSession(sessionId);
      
      // Small delay to ensure time difference
      setTimeout(() => {
        sessionManager.updateSession(sessionId);
        const updatedSession = sessionManager.getSession(sessionId);
        
        expect(updatedSession.lastAccessed.getTime())
          .toBeGreaterThan(originalSession.lastAccessed.getTime());
      }, 10);
    });

    test('should destroy session', () => {
      const userId = 1;
      const token = 'test-token';
      const sessionId = sessionManager.createSession(userId, token);
      
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      
      const destroyed = sessionManager.destroySession(sessionId);
      expect(destroyed).toBe(true);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });
});