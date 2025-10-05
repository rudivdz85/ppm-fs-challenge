import { describe, test, expect, beforeAll } from '@jest/globals';
import { PermissionService } from '../permission.service';
import { UserRepository, HierarchyRepository, PermissionRepository } from '../../repositories';
import { PermissionRole } from '@ppm/types';

// Mock data that matches our seed data structure
const MOCK_HIERARCHIES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Australia',
    path: 'australia',
    level: 0,
    is_active: true
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Sydney',
    path: 'australia.sydney',
    level: 1,
    is_active: true
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Bondi',
    path: 'australia.sydney.bondi',
    level: 2,
    is_active: true
  }
];

const MOCK_USERS = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    email: 'admin@australia.gov.au',
    full_name: 'National Administrator',
    base_hierarchy_id: '00000000-0000-0000-0000-000000000001',
    hierarchy_path: 'australia',
    hierarchy_name: 'Australia',
    is_active: true
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    email: 'manager@sydney.nsw.gov.au',
    full_name: 'Sydney City Manager',
    base_hierarchy_id: '00000000-0000-0000-0000-000000000002',
    hierarchy_path: 'australia.sydney',
    hierarchy_name: 'Sydney',
    is_active: true
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    email: 'staff@bondi.nsw.gov.au',
    full_name: 'Bondi Local Staff',
    base_hierarchy_id: '00000000-0000-0000-0000-000000000004',
    hierarchy_path: 'australia.sydney.bondi',
    hierarchy_name: 'Bondi',
    is_active: true
  }
];

const MOCK_PERMISSIONS = [
  {
    id: 'perm-001',
    user_id: '10000000-0000-0000-0000-000000000001',
    hierarchy_id: '00000000-0000-0000-0000-000000000001',
    hierarchy_path: 'australia',
    hierarchy_name: 'Australia',
    role: PermissionRole.ADMIN,
    inherit_to_descendants: true,
    is_active: true
  },
  {
    id: 'perm-002',
    user_id: '10000000-0000-0000-0000-000000000002',
    hierarchy_id: '00000000-0000-0000-0000-000000000002',
    hierarchy_path: 'australia.sydney',
    hierarchy_name: 'Sydney',
    role: PermissionRole.MANAGER,
    inherit_to_descendants: true,
    is_active: true
  },
  {
    id: 'perm-003',
    user_id: '10000000-0000-0000-0000-000000000004',
    hierarchy_id: '00000000-0000-0000-0000-000000000004',
    hierarchy_path: 'australia.sydney.bondi',
    hierarchy_name: 'Bondi',
    role: PermissionRole.READ,
    inherit_to_descendants: false,
    is_active: true
  }
];

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockHierarchyRepo: jest.Mocked<HierarchyRepository>;
  let mockPermissionRepo: jest.Mocked<PermissionRepository>;

  beforeAll(() => {
    // Create mock repositories
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      searchUsersWithHierarchy: jest.fn(),
      countByHierarchyPaths: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn()
    } as any;

    mockHierarchyRepo = {
      findById: jest.fn(),
      findByPath: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    mockPermissionRepo = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findActiveByUserIdWithHierarchy: jest.fn(),
      findByUserAndHierarchy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn()
    } as any;

    permissionService = new PermissionService(mockUserRepo, mockHierarchyRepo, mockPermissionRepo);
  });

  describe('getAccessibleUsers', () => {
    test('national user can access all users', async () => {
      // Setup mocks for national admin
      const nationalUserId = '10000000-0000-0000-0000-000000000001';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[0] // National admin permission
      ]);

      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(3);
      
      mockUserRepo.searchUsersWithHierarchy.mockResolvedValue({
        items: MOCK_USERS,
        total: 3,
        page: 1,
        limit: 50,
        pages: 1
      });

      const result = await permissionService.getAccessibleUsers(nationalUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items.length).toBe(3);
        expect(result.data.total).toBe(3);
        
        // Should include all users
        const emails = result.data.items.map(user => user.email);
        expect(emails).toContain('admin@australia.gov.au');
        expect(emails).toContain('manager@sydney.nsw.gov.au');
        expect(emails).toContain('staff@bondi.nsw.gov.au');
      }
    });

    test('city user can access city and suburb users only', async () => {
      // Setup mocks for Sydney manager
      const sydneyUserId = '10000000-0000-0000-0000-000000000002';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[1] // Sydney manager permission
      ]);

      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(2);
      
      // Return only Sydney and Bondi users (not national)
      const sydneyUsers = MOCK_USERS.filter(user => 
        user.hierarchy_path.startsWith('australia.sydney')
      );
      
      mockUserRepo.searchUsersWithHierarchy.mockResolvedValue({
        items: sydneyUsers,
        total: 2,
        page: 1,
        limit: 50,
        pages: 1
      });

      const result = await permissionService.getAccessibleUsers(sydneyUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items.length).toBe(2);
        expect(result.data.total).toBe(2);
        
        // Should include Sydney and Bondi users
        const emails = result.data.items.map(user => user.email);
        expect(emails).toContain('manager@sydney.nsw.gov.au');
        expect(emails).toContain('staff@bondi.nsw.gov.au');
        
        // Should NOT include national admin
        expect(emails).not.toContain('admin@australia.gov.au');
      }
    });

    test('suburb user can only access their own suburb users', async () => {
      // Setup mocks for Bondi staff
      const bondiUserId = '10000000-0000-0000-0000-000000000004';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[2] // Bondi staff permission (no inheritance)
      ]);

      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(1);
      
      // Return only Bondi users
      const bondiUsers = MOCK_USERS.filter(user => 
        user.hierarchy_path === 'australia.sydney.bondi'
      );
      
      mockUserRepo.searchUsersWithHierarchy.mockResolvedValue({
        items: bondiUsers,
        total: 1,
        page: 1,
        limit: 50,
        pages: 1
      });

      const result = await permissionService.getAccessibleUsers(bondiUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items.length).toBe(1);
        expect(result.data.total).toBe(1);
        
        // Should only include Bondi staff
        const emails = result.data.items.map(user => user.email);
        expect(emails).toContain('staff@bondi.nsw.gov.au');
        
        // Should NOT include Sydney manager or national admin
        expect(emails).not.toContain('manager@sydney.nsw.gov.au');
        expect(emails).not.toContain('admin@australia.gov.au');
      }
    });

    test('user with no permissions gets empty result', async () => {
      const userWithNoPermissions = '10000000-0000-0000-0000-000000999999';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([]);
      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(0);

      const result = await permissionService.getAccessibleUsers(userWithNoPermissions);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items.length).toBe(0);
        expect(result.data.total).toBe(0);
      }
    });

    test('pagination works correctly', async () => {
      const nationalUserId = '10000000-0000-0000-0000-000000000001';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[0]
      ]);

      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(3);
      
      // Mock paginated response
      mockUserRepo.searchUsersWithHierarchy.mockResolvedValue({
        items: MOCK_USERS.slice(0, 2), // First 2 users
        total: 3,
        page: 1,
        limit: 2,
        pages: 2
      });

      const result = await permissionService.getAccessibleUsers(nationalUserId, {
        page: 1,
        limit: 2
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items.length).toBe(2);
        expect(result.data.total).toBe(3);
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(2);
        expect(result.data.pages).toBe(2);
      }
    });

    test('search filter is applied correctly', async () => {
      const nationalUserId = '10000000-0000-0000-0000-000000000001';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[0]
      ]);

      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(1);
      
      // Mock search result for "Sydney"
      const sydneyUsers = MOCK_USERS.filter(user => 
        user.full_name.includes('Sydney') || user.hierarchy_name.includes('Sydney')
      );
      
      mockUserRepo.searchUsersWithHierarchy.mockResolvedValue({
        items: sydneyUsers,
        total: 1,
        page: 1,
        limit: 50,
        pages: 1
      });

      const result = await permissionService.getAccessibleUsers(nationalUserId, {
        search: 'Sydney'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items.length).toBe(1);
        expect(result.data.items[0].email).toBe('manager@sydney.nsw.gov.au');
      }

      // Verify that search criteria was passed to repository
      expect(mockUserRepo.searchUsersWithHierarchy).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Sydney'
        })
      );
    });
  });

  describe('canUserAccessUser', () => {
    test('user can access themselves', async () => {
      const userId = '10000000-0000-0000-0000-000000000001';
      
      const result = await permissionService.canUserAccessUser(userId, userId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(true);
        expect(result.data.canAccess).toBe(true);
        expect(result.data.accessLevel).toBe('direct');
      }
    });

    test('national admin can access city manager', async () => {
      const nationalUserId = '10000000-0000-0000-0000-000000000001';
      const sydneyUserId = '10000000-0000-0000-0000-000000000002';
      
      mockUserRepo.findById.mockImplementation((id) => {
        return Promise.resolve(MOCK_USERS.find(user => user.id === id));
      });

      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[0] // National admin permission with inheritance
      ]);

      const result = await permissionService.canUserAccessUser(nationalUserId, sydneyUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(true);
        expect(result.data.canAccess).toBe(true);
        expect(result.data.accessLevel).toBe('inherited');
      }
    });

    test('suburb user cannot access city manager', async () => {
      const bondiUserId = '10000000-0000-0000-0000-000000000004';
      const sydneyUserId = '10000000-0000-0000-0000-000000000002';
      
      mockUserRepo.findById.mockImplementation((id) => {
        return Promise.resolve(MOCK_USERS.find(user => user.id === id));
      });

      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[2] // Bondi staff permission (no inheritance)
      ]);

      const result = await permissionService.canUserAccessUser(bondiUserId, sydneyUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(true);
        expect(result.data.canAccess).toBe(false);
        expect(result.data.reason).toContain('not accessible');
      }
    });

    test('accessing inactive user returns false', async () => {
      const nationalUserId = '10000000-0000-0000-0000-000000000001';
      const inactiveUserId = '10000000-0000-0000-0000-000000999999';
      
      mockUserRepo.findById.mockImplementation((id) => {
        if (id === inactiveUserId) {
          return Promise.resolve({
            ...MOCK_USERS[0],
            id: inactiveUserId,
            is_active: false
          });
        }
        return Promise.resolve(MOCK_USERS.find(user => user.id === id));
      });

      const result = await permissionService.canUserAccessUser(nationalUserId, inactiveUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(false);
        expect(result.data.canAccess).toBe(false);
        expect(result.data.reason).toContain('not found or inactive');
      }
    });
  });

  describe('getUserAccessScope', () => {
    test('calculates correct access scope for national admin', async () => {
      const nationalUserId = '10000000-0000-0000-0000-000000000001';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[0]
      ]);

      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(3);

      const result = await permissionService.getUserAccessScope(nationalUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user_id).toBe(nationalUserId);
        expect(result.data.direct_permissions.length).toBe(1);
        expect(result.data.direct_permissions[0].role).toBe(PermissionRole.ADMIN);
        expect(result.data.direct_permissions[0].inherit_to_descendants).toBe(true);
        expect(result.data.total_accessible_users).toBe(3);
        expect(result.data.accessible_hierarchy_paths.length).toBeGreaterThan(0);
      }
    });

    test('calculates correct access scope for suburb user', async () => {
      const bondiUserId = '10000000-0000-0000-0000-000000000004';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([
        MOCK_PERMISSIONS[2]
      ]);

      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(1);

      const result = await permissionService.getUserAccessScope(bondiUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user_id).toBe(bondiUserId);
        expect(result.data.direct_permissions.length).toBe(1);
        expect(result.data.direct_permissions[0].role).toBe(PermissionRole.READ);
        expect(result.data.direct_permissions[0].inherit_to_descendants).toBe(false);
        expect(result.data.total_accessible_users).toBe(1);
      }
    });

    test('returns empty scope for user with no permissions', async () => {
      const userWithNoPermissions = '10000000-0000-0000-0000-000000999999';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockResolvedValue([]);
      mockHierarchyRepo.findAll.mockResolvedValue(MOCK_HIERARCHIES);
      mockUserRepo.countByHierarchyPaths.mockResolvedValue(0);

      const result = await permissionService.getUserAccessScope(userWithNoPermissions);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user_id).toBe(userWithNoPermissions);
        expect(result.data.direct_permissions.length).toBe(0);
        expect(result.data.total_accessible_users).toBe(0);
        expect(result.data.accessible_hierarchy_paths.length).toBe(0);
      }
    });
  });

  describe('Error handling', () => {
    test('handles invalid UUID gracefully', async () => {
      const result = await permissionService.getAccessibleUsers('invalid-uuid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    test('handles repository errors gracefully', async () => {
      const validUserId = '10000000-0000-0000-0000-000000000001';
      
      mockPermissionRepo.findActiveByUserIdWithHierarchy.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await permissionService.getAccessibleUsers(validUserId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Database connection failed');
      }
    });
  });
});