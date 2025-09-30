# Hierarchical Permission System - Database Schema Design

## Overview

This database schema implements a flexible hierarchical permission system using PostgreSQL with the `ltree` extension for efficient hierarchical data management. The design supports unlimited nesting levels and complex permission inheritance patterns.

## Design Decision: Materialized Path with ltree

### Why Materialized Path?
We chose the **materialized path pattern** using PostgreSQL's `ltree` extension over other hierarchical models (adjacency list, nested sets, closure table) for the following reasons:

1. **Query Performance**: Extremely fast ancestor/descendant queries using ltree operators
2. **Simplicity**: Easy to understand and maintain
3. **Flexibility**: Supports unlimited nesting levels
4. **PostgreSQL Optimization**: Native ltree support with specialized indexes (GIST)
5. **Path-based Operations**: Intuitive path-based queries and operations

### Trade-offs:
- **Write Performance**: Moving subtrees requires updating multiple paths
- **Storage**: Slightly more storage due to path redundancy
- **Complexity**: Requires triggers to maintain path consistency

## Schema Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  hierarchy_structures│    │       users         │    │    permissions      │
├─────────────────────┤    ├─────────────────────┤    ├─────────────────────┤
│ id (UUID) PK        │    │ id (UUID) PK        │    │ id (UUID) PK        │
│ name                │    │ email (UNIQUE)      │    │ name (UNIQUE)       │
│ code (UNIQUE)       │◄───┤ base_hierarchy_id FK│    │ code (UNIQUE)       │
│ path (LTREE)        │    │ first_name          │    │ resource            │
│ parent_id FK        │    │ last_name           │    │ action (ENUM)       │
│ level               │    │ password_hash       │    │ scope (ENUM)        │
│ sort_order          │    │ is_active           │    │ is_active           │
│ is_active           │    │ is_verified         │    │ conditions (JSONB)  │
│ metadata (JSONB)    │    │ timezone            │    │ ...                 │
│ ...                 │    │ ...                 │    └─────────────────────┘
└─────────────────────┘    └─────────────────────┘
           │                          │
           │                          │
           ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│      roles          │    │  user_permissions   │    │    user_roles       │
├─────────────────────┤    ├─────────────────────┤    ├─────────────────────┤
│ id (UUID) PK        │    │ user_id FK          │    │ user_id FK          │
│ name (UNIQUE)       │    │ permission_id FK    │    │ role_id FK          │
│ code (UNIQUE)       │    │ hierarchy_id FK     │    │ hierarchy_id FK     │
│ level               │    │ inherit_descendants │    │ inherit_descendants │
│ is_active           │    │ is_active           │    │ is_active           │
│ ...                 │    │ valid_from/until    │    │ valid_from/until    │
└─────────────────────┘    │ granted_by FK       │    │ assigned_by FK      │
           │                │ context_data (JSONB)│    │ ...                 │
           │                └─────────────────────┘    └─────────────────────┘
           ▼
┌─────────────────────┐
│  role_permissions   │
├─────────────────────┤
│ role_id FK          │
│ permission_id FK    │
│ inherit_descendants │
│ is_active           │
│ ...                 │
└─────────────────────┘
```

## Core Tables

### 1. hierarchy_structures
**Purpose**: Stores the organizational hierarchy using materialized path pattern

```sql
CREATE TABLE hierarchy_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    path LTREE NOT NULL,                    -- Materialized path: 'australia.sydney.cbd'
    parent_id UUID REFERENCES hierarchy_structures(id),
    level INTEGER NOT NULL DEFAULT 0,       -- 0=root, 1=first level, etc.
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features**:
- **path (ltree)**: Materialized path for O(log n) hierarchy queries
- **level**: Denormalized depth for quick level-based queries  
- **sort_order**: Custom ordering within same hierarchy level
- **metadata**: Flexible JSONB for additional attributes

**Example Hierarchy**:
```
australia (level 0, path: 'australia')
├── sydney (level 1, path: 'australia.sydney')
│   ├── cbd (level 2, path: 'australia.sydney.cbd')
│   └── eastern (level 2, path: 'australia.sydney.eastern')
└── melbourne (level 1, path: 'australia.melbourne')
    └── cbd (level 2, path: 'australia.melbourne.cbd')
```

### 2. users
**Purpose**: User accounts with base hierarchy location reference

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    base_hierarchy_id UUID NOT NULL REFERENCES hierarchy_structures(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    timezone VARCHAR(100) DEFAULT 'UTC',
    profile_data JSONB DEFAULT '{}'
);
```

**Key Features**:
- **base_hierarchy_id**: User's primary location (usually lowest level)
- **profile_data**: Flexible user attributes as JSONB

### 3. permissions
**Purpose**: System permissions using resource-action-scope model

```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,         -- e.g., 'users', 'reports'
    action permission_action NOT NULL,      -- enum: create, read, update, etc.
    scope permission_scope NOT NULL,        -- enum: own, team, organization, etc.
    conditions JSONB DEFAULT '{}'           -- Dynamic permission conditions
);
```

**Permission Model**: `Resource + Action + Scope + Conditions`
- **Resource**: What the permission applies to (users, reports, settings)
- **Action**: What can be done (create, read, update, delete, manage)
- **Scope**: Permission reach (own, team, region, organization, system)
- **Conditions**: Dynamic conditions stored as JSONB

### 4. user_permissions
**Purpose**: Direct permission grants to users with hierarchical context

```sql
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    permission_id UUID NOT NULL REFERENCES permissions(id),
    hierarchy_id UUID NOT NULL REFERENCES hierarchy_structures(id),
    inherit_to_descendants BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    context_data JSONB DEFAULT '{}'
);
```

**Key Features**:
- **hierarchy_id**: Defines the scope of this permission grant
- **inherit_to_descendants**: Whether permission applies to child nodes
- **Temporal validity**: Optional time-bound permissions
- **context_data**: Additional permission context

### 5. roles & role_permissions & user_roles
**Purpose**: Role-based access control with hierarchical context

The role system provides grouped permissions that can be assigned to users at specific hierarchy levels.

## Hierarchy Query Patterns

### Efficient ltree Queries

```sql
-- Get all descendants of a node
SELECT * FROM hierarchy_structures 
WHERE path <@ 'australia.sydney';

-- Get all ancestors of a node  
SELECT * FROM hierarchy_structures 
WHERE 'australia.sydney.cbd' ~ (path::text || '.*')::lquery;

-- Get immediate children
SELECT * FROM hierarchy_structures 
WHERE path ~ 'australia.sydney.*{1}';

-- Get nodes at specific level under a parent
SELECT * FROM hierarchy_structures 
WHERE path <@ 'australia.sydney' AND level = 2;

-- Find path between two nodes
SELECT * FROM hierarchy_structures 
WHERE path <@ 'australia' 
  AND path @> 'australia.sydney.cbd';
```

### Permission Resolution Queries

```sql
-- Check if user has permission at specific hierarchy
WITH user_effective_permissions AS (
  -- Direct permissions
  SELECT p.*, up.hierarchy_id, up.inherit_to_descendants
  FROM permissions p
  JOIN user_permissions up ON p.id = up.permission_id
  WHERE up.user_id = $1 AND up.is_active = true
  
  UNION
  
  -- Role-based permissions
  SELECT p.*, ur.hierarchy_id, rp.inherit_to_descendants
  FROM permissions p
  JOIN role_permissions rp ON p.id = rp.permission_id
  JOIN user_roles ur ON rp.role_id = ur.role_id
  WHERE ur.user_id = $1 AND ur.is_active = true AND rp.is_active = true
)
SELECT DISTINCT p.*
FROM user_effective_permissions p
JOIN hierarchy_structures h ON p.hierarchy_id = h.id
WHERE p.resource = $2 AND p.action = $3
  AND (
    h.id = $4 OR  -- Direct match
    (p.inherit_to_descendants = true AND h.path <@ (
      SELECT path FROM hierarchy_structures WHERE id = $4
    ))
  );
```

## Performance Optimizations

### Indexes

```sql
-- ltree indexes for hierarchy queries
CREATE INDEX idx_hierarchy_path_gist ON hierarchy_structures USING GIST (path);
CREATE INDEX idx_hierarchy_path_btree ON hierarchy_structures (path);

-- Composite indexes for permission queries
CREATE INDEX idx_user_permissions_lookup ON user_permissions 
  (user_id, hierarchy_id) WHERE is_active = true;

-- Partial indexes for active records
CREATE INDEX idx_hierarchy_active ON hierarchy_structures (path) 
  WHERE is_active = true;

-- GIN indexes for JSONB queries
CREATE INDEX idx_hierarchy_metadata ON hierarchy_structures USING GIN (metadata);
CREATE INDEX idx_permissions_conditions ON permissions USING GIN (conditions);
```

### Query Optimization Strategies

1. **Use ltree operators** instead of string operations
2. **Leverage partial indexes** for active-only queries
3. **Use composite indexes** for multi-column lookups
4. **Consider materialized views** for complex permission aggregations
5. **Implement query result caching** for frequently accessed permissions

## Data Integrity & Triggers

### Automatic Path Management
```sql
-- Trigger to automatically generate/update paths
CREATE TRIGGER trigger_validate_hierarchy_path
    BEFORE INSERT OR UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION validate_hierarchy_path();
```

### Cycle Prevention
```sql
-- Prevent circular references in hierarchy
CREATE TRIGGER trigger_prevent_hierarchy_cycles
    BEFORE UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION prevent_hierarchy_cycles();
```

### Cascading Path Updates
```sql
-- Update descendant paths when parent path changes
CREATE TRIGGER trigger_update_descendant_paths
    AFTER UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION update_descendant_paths();
```

## Permission Inheritance Model

### Inheritance Rules
1. **Direct Permissions**: Explicitly granted to user at specific hierarchy
2. **Role Permissions**: Inherited through role assignment
3. **Hierarchical Inheritance**: Permissions flow down the hierarchy tree
4. **Scope-based Resolution**: Permission scope determines effective range

### Permission Resolution Algorithm
```
For permission check (user, resource, action, hierarchy):
1. Check direct user permissions at target hierarchy
2. Check inherited permissions from ancestor hierarchies
3. Check role-based permissions at target hierarchy  
4. Check role-based inherited permissions from ancestors
5. Apply scope restrictions (own, team, organization, etc.)
6. Evaluate dynamic conditions
7. Return most permissive result
```

## Example Use Cases

### 1. Regional Manager Access
A regional manager in Sydney should have access to:
- All Sydney hierarchy descendants (cbd, eastern suburbs, etc.)
- User management permissions within their region
- Report generation for their area

```sql
-- Grant Sydney regional manager role
INSERT INTO user_roles (user_id, role_id, hierarchy_id, inherit_to_descendants)
VALUES ($user_id, $regional_manager_role, $sydney_hierarchy_id, true);
```

### 2. Temporary Project Access
Grant a user temporary access to a different region for a specific project:

```sql
-- Grant temporary permission with expiration
INSERT INTO user_permissions (
  user_id, permission_id, hierarchy_id, 
  valid_until, context_data
) VALUES (
  $user_id, $report_access_permission, $brisbane_hierarchy_id,
  '2024-12-31'::timestamp, 
  '{"project": "cross-city-analytics", "temporary": true}'::jsonb
);
```

### 3. Hierarchical Permission Check
Check if a user can manage users in a specific suburb:

```sql
SELECT check_user_permission(
  $user_id, 
  'users', 
  'manage', 
  $suburb_hierarchy_id
);
```

## Security Considerations

1. **Principle of Least Privilege**: Users get minimum required permissions
2. **Temporal Permissions**: Support for time-bound access
3. **Audit Trail**: Complete audit log of permission grants/revokes
4. **Permission Scope Validation**: Prevent privilege escalation
5. **Secure Defaults**: New entities default to restricted access

## Migration Strategy

1. **Phase 1**: Create base schema with hierarchy and users
2. **Phase 2**: Add permission system and basic roles  
3. **Phase 3**: Implement inheritance and advanced features
4. **Phase 4**: Add audit logging and advanced security

This design provides a robust foundation for complex organizational permission management while maintaining query performance and data integrity.