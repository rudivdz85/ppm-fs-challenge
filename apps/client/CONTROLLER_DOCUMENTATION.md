# API Controllers Documentation

This document provides comprehensive documentation for all API controllers in the hierarchical permission system.

## Authentication & Authorization

All endpoints (except auth/login and auth/register) require:
- **Authentication**: Bearer token in Authorization header
- **Authorization**: Appropriate permissions based on hierarchy access

## Controllers Overview

### 1. AuthController (`/api/auth`)

Handles authentication, registration, and password operations.

#### Endpoints

**POST /api/auth/login**
```typescript
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "token": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresAt": "2024-01-02T12:00:00.000Z"
  }
}
```

**POST /api/auth/register**
```typescript
// Request
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "base_hierarchy_id": "hierarchy-uuid",
  "phone": "+1234567890"
}

// Response: Same as login
```

**POST /api/auth/refresh**
```typescript
// Request
{
  "refresh_token": "refresh-jwt-token"
}

// Response: New token pair
```

**GET /api/auth/me**
```typescript
// Response: Current user profile
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "hierarchy_path": "Company.Department.Team"
  }
}
```

**POST /api/auth/change-password**
```typescript
// Request
{
  "current_password": "oldpassword",
  "new_password": "NewSecurePass123!",
  "confirm_password": "NewSecurePass123!"
}
```

### 2. UserController (`/api/users`)

Manages user CRUD operations, search, and profile management.

#### Endpoints

**GET /api/users**
```typescript
// Query Parameters
?page=1&limit=20&search=john&is_active=true&sort_by=full_name&sort_order=asc

// Response
{
  "success": true,
  "data": [/* user array */],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

**GET /api/users/:id**
```typescript
// Response: Single user object
```

**POST /api/users**
```typescript
// Request (admin/manager only)
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "base_hierarchy_id": "hierarchy-uuid",
  "phone": "+1234567890",
  "metadata": { "department": "Engineering" }
}
```

**PUT /api/users/:id**
```typescript
// Request
{
  "full_name": "John Smith",
  "phone": "+1234567890",
  "is_active": true,
  "metadata": { "department": "Marketing" }
}
```

**DELETE /api/users/:id**
```typescript
// Soft delete (deactivate user)
// Response: 204 No Content
```

**PUT /api/users/profile**
```typescript
// Self-service profile update
{
  "full_name": "John Smith",
  "phone": "+1234567890",
  "metadata": {
    "bio": "Software Engineer",
    "timezone": "America/New_York"
  }
}
```

**GET /api/users/search/autocomplete**
```typescript
// Query: ?search=john&limit=10&exclude_inactive=true
// Response: Simplified user objects for autocomplete
```

### 3. PermissionController (`/api/permissions`)

Handles permission granting, revoking, and access control operations.

#### Endpoints

**POST /api/permissions**
```typescript
// Grant permission
{
  "user_id": "user-uuid",
  "hierarchy_id": "hierarchy-uuid",
  "role": "manager",
  "inherit_to_descendants": true,
  "expires_at": "2024-12-31T23:59:59Z",
  "metadata": { "reason": "Project assignment" }
}
```

**DELETE /api/permissions/:id**
```typescript
// Revoke permission
// Response: 204 No Content
```

**PUT /api/permissions/:id**
```typescript
// Update permission
{
  "role": "admin",
  "inherit_to_descendants": false,
  "expires_at": "2025-12-31T23:59:59Z",
  "metadata": { "updated_reason": "Role promotion" }
}
```

**GET /api/permissions/user/:userId**
```typescript
// Get user's permissions
// Response: Array of permission objects
```

**GET /api/permissions/scope/:userId**
```typescript
// Get user's access scope
{
  "success": true,
  "data": {
    "accessible_hierarchy_ids": ["uuid1", "uuid2"],
    "total_accessible_users": 150,
    "effective_roles": {
      "hierarchy-uuid": "manager"
    }
  }
}
```

**POST /api/permissions/check/user-access**
```typescript
// Check if user can access another user
{
  "target_user_id": "target-user-uuid"
}

// Response
{
  "canAccess": true,
  "accessLevel": "direct",
  "effectiveRole": "manager"
}
```

**POST /api/permissions/check/structure-access**
```typescript
// Check if user can access hierarchy structure
{
  "hierarchy_id": "hierarchy-uuid"
}
```

### 4. QueryController (`/api/query`) - Core Feature

Complex user queries with analytics and filtering capabilities.

#### Main Endpoint

**POST /api/query/users**
```typescript
// Request - Advanced filtering
{
  "hierarchy_filters": {
    "include_paths": ["Company.Engineering"],
    "exclude_paths": ["Company.HR"],
    "depth_range": { "min": 2, "max": 4 }
  },
  "user_filters": {
    "is_active": true,
    "search": "john",
    "created_after": "2024-01-01",
    "roles": ["manager", "admin"]
  },
  "permission_filters": {
    "has_permissions": true,
    "roles": ["read", "manager"],
    "granted_by": "granter-uuid"
  },
  "output_options": {
    "include_hierarchy_info": true,
    "include_permission_summary": true,
    "include_analytics": true
  },
  "pagination": {
    "page": 1,
    "limit": 50
  }
}

// Response - Rich data with analytics
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "email": "john@example.com",
      "full_name": "John Doe",
      "hierarchy_info": {
        "structure_name": "Engineering Team",
        "path": "Company.Engineering.Backend",
        "depth": 3
      },
      "permission_summary": {
        "effective_role": "manager",
        "direct_permissions": 2,
        "inherited_permissions": 5
      }
    }
  ],
  "pagination": { /* pagination info */ },
  "meta": {
    "analytics": {
      "total_users_in_scope": 250,
      "hierarchy_distribution": {
        "Company.Engineering": 45,
        "Company.Sales": 30
      },
      "role_distribution": {
        "read": 150,
        "manager": 80,
        "admin": 20
      },
      "permission_statistics": {
        "users_with_permissions": 200,
        "average_permissions_per_user": 3.2
      }
    },
    "requestor_context": {
      "requesting_user_id": "requester-uuid",
      "accessible_hierarchy_count": 10,
      "query_scope": "filtered_by_permissions"
    }
  }
}
```

**GET /api/query/analytics**
```typescript
// Query: ?hierarchy_id=uuid&include_trends=true&period=30d
// Response: Detailed analytics and trends
```

### 5. HierarchyController (`/api/hierarchies`)

Manages organizational hierarchy structure operations.

#### Endpoints

**GET /api/hierarchies**
```typescript
// List hierarchies with pagination and filtering
// Query: ?search=engineering&is_active=true&parent_id=uuid
```

**GET /api/hierarchies/tree**
```typescript
// Get hierarchy tree structure
// Query: ?root_id=uuid&max_depth=5&include_inactive=false

// Response
{
  "success": true,
  "data": {
    "id": "root-uuid",
    "name": "Company",
    "path": "Company",
    "children": [
      {
        "id": "dept-uuid",
        "name": "Engineering",
        "path": "Company.Engineering",
        "children": [/* nested structures */]
      }
    ]
  }
}
```

**POST /api/hierarchies**
```typescript
// Create new hierarchy structure
{
  "name": "New Department",
  "parent_id": "parent-uuid",
  "description": "Department description",
  "metadata": { "budget": 100000 }
}
```

**PUT /api/hierarchies/:id**
```typescript
// Update hierarchy structure
{
  "name": "Updated Department",
  "description": "New description",
  "is_active": true
}
```

**POST /api/hierarchies/:id/move**
```typescript
// Move structure to new parent
{
  "new_parent_id": "new-parent-uuid"
}
```

**GET /api/hierarchies/:id/descendants**
```typescript
// Get all descendants of a structure
// Query: ?max_depth=3&include_users=true
```

## Error Handling

All endpoints return consistent error responses:

```typescript
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": { /* additional context */ }
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req-uuid"
  }
}
```

## Common HTTP Status Codes

- **200**: Success
- **201**: Created
- **204**: No Content (successful deletion)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate resource)
- **500**: Internal Server Error

## Authentication Flow

1. **Login**: POST `/api/auth/login` → Receive access & refresh tokens
2. **API Calls**: Include `Authorization: Bearer <access-token>` header
3. **Token Refresh**: When access token expires, use refresh token
4. **Logout**: POST `/api/auth/logout` (client-side token removal)

## Permission Levels

- **read**: Can view resources in assigned hierarchies
- **manager**: Can manage users and permissions in assigned hierarchies
- **admin**: Full access to manage hierarchies, users, and permissions

## Hierarchy Path Format

Hierarchies use dot-notation paths: `Company.Department.Team.Subteam`
- Enables efficient ancestry queries using PostgreSQL ltree
- Maximum depth: 10 levels
- Path length: 255 characters maximum

## Rate Limiting & Security

- All endpoints implement rate limiting
- Passwords require: 8+ chars, uppercase, lowercase, number, special char
- JWT tokens expire after 1 hour (access) / 7 days (refresh)
- All sensitive operations require password verification
- Comprehensive audit logging for all permission changes