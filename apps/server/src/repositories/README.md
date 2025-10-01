# Repository Layer

This directory contains the repository layer implementation following the **Repository Pattern** for the hierarchical permission system. The repositories provide a clean abstraction over database operations and contain all SQL queries and data access logic.

## Architecture Overview

### Repository Pattern Benefits

- **Separation of Concerns**: Database logic is isolated from business logic
- **Testability**: Easy to mock for unit testing
- **Maintainability**: Centralized data access patterns
- **Type Safety**: Full TypeScript integration with proper typing
- **Security**: Prepared statements prevent SQL injection

### Layer Structure

```
├── base.repository.ts          # Base class with common operations
├── hierarchy.repository.ts     # Hierarchy structure operations
├── user.repository.ts         # User management with hierarchy context
├── permission.repository.ts   # Access control and permission logic
├── utils/
│   ├── query-builder.ts       # SQL query building utilities
│   └── transaction.ts         # Transaction management
└── index.ts                   # Repository exports
```

## Core Repositories

### 1. HierarchyRepository

Manages the organizational hierarchy using PostgreSQL's ltree extension for efficient tree operations.

**Key Features:**
- Materialized path queries using ltree operators
- Automatic path generation and validation
- Hierarchy integrity checking
- Optimized ancestor/descendant lookups

**Usage Example:**

```typescript
import { HierarchyRepository } from '@/repositories';

const hierarchyRepo = new HierarchyRepository();

// Create a new location
const sydney = await hierarchyRepo.create({
  name: 'Sydney',
  code: 'sydney',
  parent_id: australiaId,
  metadata: { timezone: 'Australia/Sydney' }
});

// Get all descendants (efficient ltree query)
const sydneyRegions = await hierarchyRepo.findDescendants('australia.sydney');

// Move a subtree to new parent
await hierarchyRepo.move(nodeId, newParentId);
```

### 2. UserRepository

Handles user management with hierarchy-aware operations for organizational context.

**Key Features:**
- Hierarchy-scoped user queries
- Search across organizational boundaries
- Bulk operations with validation
- User statistics by hierarchy level

**Usage Example:**

```typescript
import { UserRepository } from '@/repositories';

const userRepo = new UserRepository();

// Create user with hierarchy assignment
const user = await userRepo.create({
  email: 'john.doe@company.com',
  first_name: 'John',
  last_name: 'Doe',
  password_hash: hashedPassword,
  base_hierarchy_id: sydneyId
});

// Find users in Sydney and all sub-regions
const sydneyUsers = await userRepo.findByStructurePath('australia.sydney');

// Search users with hierarchy context
const searchResults = await userRepo.searchUsers('john', {
  hierarchyPath: 'australia.sydney',
  limit: 20
});
```

### 3. PermissionRepository

**Core business logic repository** handling access control, permission grants, and security policies.

**Key Features:**
- Permission inheritance through hierarchy
- Role-based access control (RBAC)
- Real-time permission checking
- Audit trail for compliance

**Usage Example:**

```typescript
import { PermissionRepository } from '@/repositories';

const permissionRepo = new PermissionRepository();

// Grant permission to user
await permissionRepo.grantUserPermission({
  user_id: userId,
  permission_id: reportsReadPermissionId,
  hierarchy_id: sydneyId,
  inherit_to_descendants: true,
  granted_by: adminId
});

// Check if user can access resource
const canAccess = await permissionRepo.hasPermission(
  userId, 
  'reports', 
  'read', 
  hierarchyId
);

// Get all users this user can access (core business logic)
const accessibleUsers = await permissionRepo.getAccessibleUsers(
  userId,
  'view'
);
```

## Utility Modules

### Query Builder

Provides safe SQL query construction with parameter binding:

```typescript
import { buildSelectQuery, buildWhereClause } from '@/repositories/utils/query-builder';

// Build complex queries safely
const { query, params } = buildSelectQuery({
  select: ['u.*', 'h.name as hierarchy_name'],
  from: 'users u',
  joins: ['JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id'],
  where: [
    { field: 'u.is_active', operator: '=', value: true },
    { field: 'h.path', operator: '<@', value: 'australia.sydney' }
  ],
  orderBy: [{ field: 'u.last_name', direction: 'ASC' }],
  pagination: { limit: 50, offset: 0 }
});
```

### Transaction Management

Provides automatic transaction handling with rollback on errors:

```typescript
import { withTransaction } from '@/repositories/utils/transaction';

// Execute multiple operations in transaction
const result = await withTransaction(async (client) => {
  const user = await userRepo.create(userData);
  await permissionRepo.grantUserPermission({
    user_id: user.id,
    permission_id: permissionId,
    hierarchy_id: hierarchyId,
    granted_by: adminId
  });
  return user;
});
```

## Base Repository

All repositories extend `BaseRepository` which provides:

- **Common CRUD operations** (findOne, findMany, insertOne, updateById, etc.)
- **Query execution** with error handling
- **Validation helpers** (UUID, email, required fields)
- **Transaction support** for complex operations
- **Consistent error handling** with application-specific errors

## Error Handling

Repositories use typed errors for consistent error handling:

```typescript
import { NotFoundError, ValidationError, DuplicateError } from '@/models';

try {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new NotFoundError('User', userId);
  }
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle not found
  } else if (error instanceof ValidationError) {
    // Handle validation error
  }
}
```

## Testing Strategy

Repositories are designed for easy testing:

### Unit Testing

```typescript
import { HierarchyRepository } from '@/repositories';
import { mockPoolClient } from '@/test/mocks';

describe('HierarchyRepository', () => {
  let repo: HierarchyRepository;
  let mockClient: jest.Mocked<PoolClient>;

  beforeEach(() => {
    mockClient = mockPoolClient();
    repo = new HierarchyRepository(mockClient);
  });

  it('should create hierarchy node with correct path', async () => {
    mockClient.query.mockResolvedValue({
      rows: [{ id: 'uuid', path: 'australia.sydney' }]
    });

    const result = await repo.create({
      name: 'Sydney',
      code: 'sydney',
      parent_id: 'australia-id'
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO hierarchy_structures'),
      expect.arrayContaining(['Sydney', 'sydney'])
    );
  });
});
```

### Integration Testing

```typescript
import { db } from '@/database/connection';
import { HierarchyRepository } from '@/repositories';

describe('HierarchyRepository Integration', () => {
  let repo: HierarchyRepository;

  beforeAll(async () => {
    repo = new HierarchyRepository();
    await db.query('BEGIN');
  });

  afterAll(async () => {
    await db.query('ROLLBACK');
  });

  it('should handle hierarchy operations end-to-end', async () => {
    const parent = await repo.create({
      name: 'Australia',
      code: 'australia'
    });

    const child = await repo.create({
      name: 'Sydney',
      code: 'sydney',
      parent_id: parent.id
    });

    const descendants = await repo.findDescendants('australia');
    expect(descendants).toHaveLength(1);
    expect(descendants[0].id).toBe(child.id);
  });
});
```

## Performance Considerations

### Indexing Strategy

All repositories leverage comprehensive database indexes:

```sql
-- Hierarchy queries (GIST for ltree operations)
CREATE INDEX idx_hierarchy_path_gist ON hierarchy_structures USING GIST (path);

-- User lookups
CREATE INDEX idx_users_base_hierarchy ON users (base_hierarchy_id) WHERE is_active = true;

-- Permission checks (composite indexes)
CREATE INDEX idx_user_permissions_active ON user_permissions 
  (user_id, hierarchy_id, permission_id) WHERE is_active = true;
```

### Query Optimization

- **ltree operators** for O(log n) hierarchy queries instead of recursive CTEs
- **Prepared statements** for all queries prevent parsing overhead
- **Partial indexes** on active records only
- **Early returns** in permission checking functions

### Caching Strategy

For high-performance applications, consider implementing:

- **Permission result caching** (Redis/in-memory)
- **Hierarchy structure caching** for static organizational data
- **User accessible data caching** for dashboard optimizations

## Common Patterns

### Hierarchy-Aware Queries

Most operations include hierarchy context:

```typescript
// Always filter by hierarchy path when needed
const users = await userRepo.findByStructurePath('australia.sydney');

// Check permissions with hierarchy inheritance
const hasAccess = await permissionRepo.hasPermission(
  userId, 'users', 'read', hierarchyId
);
```

### Bulk Operations

For performance, use bulk operations when possible:

```typescript
// Bulk permission checking
const permissions = await permissionRepo.bulkCheckPermissions(userId, [
  { resource: 'users', action: 'read' },
  { resource: 'reports', action: 'create' }
], hierarchyId);

// Bulk user hierarchy updates
await userRepo.bulkUpdateHierarchy(userIds, newHierarchyId);
```

### Transaction Usage

Use transactions for operations affecting multiple tables:

```typescript
// User creation with initial permissions
const user = await withTransaction(async () => {
  const newUser = await userRepo.create(userData);
  await permissionRepo.grantUserPermission({
    user_id: newUser.id,
    permission_id: defaultPermissionId,
    hierarchy_id: newUser.base_hierarchy_id,
    granted_by: adminId
  });
  return newUser;
});
```

## Best Practices

1. **Always validate UUIDs** before database operations
2. **Use transactions** for multi-table operations
3. **Leverage hierarchy inheritance** for efficient permission checking
4. **Implement soft deletes** for audit trail preservation
5. **Use typed errors** for consistent error handling
6. **Validate business rules** at the repository level
7. **Log performance-critical operations** for monitoring
8. **Use prepared statements** for all queries
9. **Implement pagination** for large result sets
10. **Test with real database constraints** in integration tests

## Migration from Repository

When implementing services/controllers:

```typescript
// Service layer example
export class UserService {
  constructor(
    private userRepo: UserRepository,
    private permissionRepo: PermissionRepository
  ) {}

  async getUsersInRegion(requestingUserId: string, regionPath: string) {
    // Check if requesting user can access this region
    const accessibleStructures = await this.permissionRepo.getAccessibleStructures(
      requestingUserId, 'read'
    );
    
    const canAccess = accessibleStructures.some(s => 
      regionPath.startsWith(s.path) || s.path.startsWith(regionPath)
    );
    
    if (!canAccess) {
      throw new ForbiddenError('Access denied to this region');
    }

    return this.userRepo.findByStructurePath(regionPath);
  }
}
```

This repository layer provides a solid foundation for building secure, scalable applications with complex hierarchical permission requirements.