# Service Layer Documentation

The service layer contains all business logic for the hierarchical permission system. Services orchestrate repository operations, enforce business rules, and provide a clean API for the controller layer.

## Architecture Overview

```
Controllers → Services → Repositories → Database
```

- **Controllers**: Handle HTTP requests/responses, validation
- **Services**: Business logic, orchestration, rule enforcement
- **Repositories**: Data access patterns, database operations
- **Database**: PostgreSQL with ltree for hierarchies

## Core Services

### 1. AuthService (`auth.service.ts`)

**Purpose**: Authentication, password management, and JWT token handling

**Key Methods**:
- `login(request)` - Authenticate user and return JWT token
- `refreshToken(request)` - Refresh access token using refresh token
- `validateToken(token)` - Validate JWT token and return payload
- `hashPassword(password)` - Hash password using bcrypt
- `comparePassword(plaintext, hash)` - Compare password with hash
- `verifyUserPassword(request)` - Verify user's current password
- `getCurrentUser(token)` - Get user info from token

**Features**:
- JWT authentication with refresh tokens
- bcrypt password hashing (12 rounds)
- Token validation and extraction utilities
- Password reset token generation (placeholder)
- Comprehensive audit logging

### 2. UserService (`user.service.ts`)

**Purpose**: User management and hierarchy associations

**Key Methods**:
- `createUser(request, createdBy)` - Create new user with validation
- `updateUser(userId, request, updatedBy)` - Update user information
- `getUserById(id, includeHierarchy)` - Get user with optional hierarchy details
- `searchUsers(filters)` - Search users with pagination and filtering
- `changeUserStructure(userId, newStructureId, changedBy)` - Move user to different hierarchy
- `changePassword(userId, request, changedBy)` - Change user password
- `deactivateUser(userId, deactivatedBy)` - Soft delete user

**Features**:
- Comprehensive validation and sanitization
- Business rule enforcement (email uniqueness, hierarchy constraints)
- Password strength validation
- Audit logging for all operations
- Support for user metadata

### 3. HierarchyService (`hierarchy.service.ts`)

**Purpose**: Hierarchy structure management and validation

**Key Methods**:
- `createStructure(request, createdBy)` - Create new hierarchy node
- `updateStructure(id, request, updatedBy)` - Update hierarchy node
- `deleteStructure(id, deletedBy)` - Soft delete hierarchy node
- `getStructureById(id, includeChildren)` - Get hierarchy with optional children
- `getHierarchyTree(rootId?)` - Get full hierarchy tree
- `moveStructure(id, newParentId, movedBy)` - Move node to new parent
- `validateHierarchy()` - Validate entire hierarchy integrity
- `getHierarchyStatistics()` - Get hierarchy metrics

**Features**:
- ltree path calculation and management
- Hierarchy integrity validation
- Tree building and flattening utilities
- Business rule enforcement (circular references, level constraints)
- Audit logging for structural changes

### 4. PermissionService (`permission.service.ts`)

**Purpose**: Core access control logic and permission management

**Key Methods**:
- `grantPermission(request, grantedBy)` - Grant permission with validation
- `revokePermission(permissionId, revokedBy)` - Revoke permission
- `updatePermission(permissionId, request, updatedBy)` - Update permission details
- `getUserPermissions(userId)` - Get all permissions for user
- `getAccessibleUsers(requestingUserId, filters)` - **THE CORE FEATURE** - Get users accessible to requesting user
- `canUserAccessUser(requestingUserId, targetUserId)` - Check if user can access another user
- `canUserAccessStructure(requestingUserId, hierarchyId)` - Check hierarchy access
- `getUserAccessScope(userId)` - Get complete access scope for user

**Features**:
- Role-based permission system (READ, MANAGER, ADMIN)
- Hierarchical inheritance with descendant access
- Permission validation and business rule enforcement
- Access scope calculation with ltree queries
- Comprehensive audit logging

### 5. QueryService (`query.service.ts`)

**Purpose**: Main user query endpoint with analytics and complex filtering

**Key Methods**:
- `queryUsers(requestingUserId, filters)` - **PRIMARY FEATURE** - Complex user queries with analytics
- `getUserStats(requestingUserId, request)` - Dashboard statistics
- `bulkQueryUsers(requestingUserId, request)` - Bulk query for specific users
- `searchUsersAutocomplete(requestingUserId, searchTerm)` - Autocomplete search

**Features**:
- Complex filtering (search, hierarchy, role, dates, levels)
- Real-time analytics and hierarchy coverage
- Performance monitoring and optimization
- Bulk operations with access control
- Autocomplete search with permission filtering

## Service Utilities

### Validator (`utils/validator.ts`)

**Purpose**: Input validation and business rule validation

**Key Functions**:
- `validateEmail(email)` - Email format validation
- `validateUUID(id)` - UUID format validation
- `validatePassword(password, requirements)` - Password strength validation
- `validateRequired(object, fields)` - Required field validation
- `sanitizeSearchTerm(term)` - Search input sanitization

### HierarchyCalculator (`utils/hierarchy-calculator.ts`)

**Purpose**: Hierarchy calculations and ltree utilities

**Key Functions**:
- `calculatePath(parentPath, nodeCode)` - Calculate ltree path
- `calculateLevel(path)` - Calculate hierarchy level
- `isAncestor(ancestorPath, descendantPath)` - Check ancestry
- `buildHierarchyTree(structures)` - Build tree from flat list
- `calculateAccessScope(permissions, hierarchies)` - Calculate access scope
- `isHierarchyAccessible(targetPath, scopes)` - Check accessibility

### ServiceLogger (`utils/logger.ts`)

**Purpose**: Structured logging with audit capabilities

**Key Features**:
- Service-specific loggers with context
- Specialized logging methods (auth, permission, audit)
- Structured log format with metadata
- Error logging with stack traces

## Data Flow

### 1. User Authentication

```
1. User submits login credentials
2. AuthService.login() validates and authenticates
3. Password comparison with bcrypt
4. JWT token generation with user context
5. Return user data and tokens
```

### 2. Permission Checking

```
1. User requests access to another user
2. PermissionService.canUserAccessUser() called
3. Get requesting user's access scope
4. Check if target user's hierarchy is accessible
5. Return permission result with effective role
```

### 3. User Query (Core Feature)

```
1. QueryService.queryUsers() called with filters
2. PermissionService.getAccessibleUsers() gets scope
3. UserRepository searches within accessible hierarchies
4. Results enhanced with access context
5. Analytics calculated and returned
```

## Business Rules

### User Management
- Email addresses must be unique across the system
- Users cannot be assigned to hierarchies above their base level
- Password changes require current password verification
- User deactivation cascades to permission revocation

### Permission Management
- Users can only grant permissions they have themselves
- ADMIN role can grant any permission within their scope
- MANAGER role can grant READ and MANAGER permissions
- READ role cannot grant any permissions
- Permissions inherit to descendants when configured

### Hierarchy Management
- Hierarchy codes must be unique within their parent
- Moving hierarchies validates all descendant constraints
- Circular references are prevented
- Level calculations are automatically maintained

## Error Handling

All services use the `ServiceResult<T>` pattern:

```typescript
type ServiceResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: AppError;
};
```

**Error Types**:
- `ValidationError` - Input validation failures (400)
- `BusinessRuleError` - Business logic violations (400)
- `NotFoundError` - Resource not found (404)
- `UnauthorizedError` - Access denied (401)
- `ConflictError` - Resource conflicts (409)

## Security Features

### Authentication
- JWT tokens with configurable expiration
- Refresh token rotation
- Password hashing with bcrypt (12 rounds)
- Token extraction and validation utilities

### Authorization
- Role-based access control (RBAC)
- Hierarchical permission inheritance
- Scope-based access (direct vs inherited)
- Request context validation

### Audit Logging
- All permission changes logged
- User authentication events tracked
- Hierarchy modifications recorded
- Failed access attempts logged

## Performance Considerations

### Database Optimization
- ltree indexes for fast hierarchy queries
- Optimized joins for user-hierarchy relationships
- Pagination for large result sets
- Prepared statements in repositories

### Caching Strategy
- User session caching
- Permission scope caching
- Hierarchy tree caching
- Query result caching (future enhancement)

### Query Optimization
- Efficient ltree pattern matching
- Minimized database round trips
- Bulk operations where possible
- Connection pooling

## Usage Examples

### Creating a User
```typescript
const userService = new UserService(userRepo, hierarchyRepo, authService);

const result = await userService.createUser({
  email: 'user@example.com',
  password: 'SecurePass123!',
  full_name: 'John Doe',
  base_hierarchy_id: 'hierarchy-uuid'
}, 'creator-user-id');

if (result.success) {
  console.log('User created:', result.data.id);
}
```

### Granting Permission
```typescript
const permissionService = new PermissionService(userRepo, hierarchyRepo, permissionRepo);

const result = await permissionService.grantPermission({
  user_id: 'user-uuid',
  hierarchy_id: 'hierarchy-uuid',
  role: PermissionRole.MANAGER,
  inherit_to_descendants: true
}, 'granting-user-id');
```

### Querying Accessible Users
```typescript
const queryService = new QueryService(userRepo, hierarchyRepo, permissionRepo, permissionService, authService);

const result = await queryService.queryUsers('requesting-user-id', {
  search: 'john',
  hierarchy_id: 'specific-hierarchy',
  sort_by: 'full_name',
  page: 1,
  limit: 20
});

if (result.success) {
  console.log(`Found ${result.data.total} users`);
  console.log('Analytics:', result.data.analytics);
}
```

## Testing Strategy

### Unit Tests
- Service method isolation
- Mock repository dependencies
- Business rule validation
- Error handling scenarios

### Integration Tests
- Service interaction testing
- Database transaction testing
- Permission inheritance validation
- Complex query scenarios

### Performance Tests
- Large hierarchy performance
- Bulk operation testing
- Concurrent access testing
- Memory usage monitoring

## Future Enhancements

### Planned Features
- Role-based permission inheritance
- Advanced caching layer
- Real-time permission updates
- Audit log querying API
- Permission approval workflows

### Scalability Improvements
- Read replicas for queries
- Redis caching layer
- Background job processing
- Horizontal scaling support

## Configuration

### Environment Variables
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - Access token expiration
- `REFRESH_TOKEN_EXPIRES_IN` - Refresh token expiration
- `BCRYPT_ROUNDS` - Password hashing rounds

### Service Configuration
```typescript
const services = {
  userService: new UserService(userRepo, hierarchyRepo, authService),
  authService: new AuthService(userRepo),
  hierarchyService: new HierarchyService(hierarchyRepo, userRepo),
  permissionService: new PermissionService(userRepo, hierarchyRepo, permissionRepo),
  queryService: new QueryService(userRepo, hierarchyRepo, permissionRepo, permissionService, authService)
};
```