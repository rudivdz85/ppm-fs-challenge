-- Migration: 003_create_permissions.sql
-- Description: Create hierarchical permissions system
-- Author: PPM FS Challenge
-- Created: 2025-09-29

-- Create permission_types enumeration
CREATE TYPE permission_action AS ENUM (
    'create', 'read', 'update', 'delete', 'list', 
    'execute', 'manage', 'approve', 'reject', 'export', 'import'
);

CREATE TYPE permission_scope AS ENUM (
    'own',          -- Own records only
    'team',         -- Team/department level
    'branch',       -- Branch/location level  
    'region',       -- Regional level
    'organization', -- Organization-wide
    'system'        -- System-wide (super admin)
);

-- Create permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Permission identification
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- Programmatic identifier
    description TEXT,
    
    -- Permission definition
    resource VARCHAR(100) NOT NULL, -- e.g., 'users', 'reports', 'settings'
    action permission_action NOT NULL,
    scope permission_scope NOT NULL DEFAULT 'own',
    
    -- Permission metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_permission BOOLEAN NOT NULL DEFAULT false, -- Core system permissions
    
    -- Conditions for dynamic permissions (stored as JSONB)
    conditions JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT permissions_code_format CHECK (code ~ '^[a-z0-9_]+$'),
    CONSTRAINT permissions_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT permissions_resource_not_empty CHECK (LENGTH(TRIM(resource)) > 0)
);

-- Create user_permissions table (many-to-many with hierarchy context)
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core references
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    -- Hierarchy context - defines the scope of this permission
    hierarchy_id UUID NOT NULL REFERENCES hierarchy_structures(id) ON DELETE CASCADE,
    
    -- Permission inheritance settings
    inherit_to_descendants BOOLEAN NOT NULL DEFAULT true,  -- Permission applies to child nodes
    inherit_from_ancestors BOOLEAN NOT NULL DEFAULT false, -- Permission inherited from parent nodes
    
    -- Permission metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_explicit BOOLEAN NOT NULL DEFAULT true, -- false for inherited permissions
    
    -- Validity period (optional)
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Additional context data
    context_data JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT user_permissions_validity_check CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),
    CONSTRAINT user_permissions_revocation_check CHECK (
        (revoked_at IS NULL AND revoked_by IS NULL) OR 
        (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    ),
    
    -- Unique constraint to prevent duplicate active permissions
    CONSTRAINT user_permissions_unique_active UNIQUE (user_id, permission_id, hierarchy_id)
        DEFERRABLE INITIALLY DEFERRED
);

-- Create role-based permissions (optional enhancement)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 0, -- Hierarchy level for role comparison
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT roles_code_format CHECK (code ~ '^[a-z0-9_]+$'),
    CONSTRAINT roles_level_check CHECK (level >= 0)
);

-- Create role_permissions table
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    inherit_to_descendants BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- Create user_roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    hierarchy_id UUID NOT NULL REFERENCES hierarchy_structures(id) ON DELETE CASCADE,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    inherit_to_descendants BOOLEAN NOT NULL DEFAULT true,
    
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT user_roles_validity_check CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),
    CONSTRAINT user_roles_unique_active UNIQUE (user_id, role_id, hierarchy_id)
);

-- Create comprehensive indexes for permissions
CREATE INDEX idx_permissions_code ON permissions(code);
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_scope ON permissions(scope);
CREATE INDEX idx_permissions_active ON permissions(is_active);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

-- Create indexes for user_permissions
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_hierarchy_id ON user_permissions(hierarchy_id);
CREATE INDEX idx_user_permissions_active ON user_permissions(is_active);
CREATE INDEX idx_user_permissions_explicit ON user_permissions(is_explicit);
CREATE INDEX idx_user_permissions_validity ON user_permissions(valid_from, valid_until);

-- Create composite indexes for common queries
CREATE INDEX idx_user_permissions_user_hierarchy ON user_permissions(user_id, hierarchy_id) WHERE is_active = true;
CREATE INDEX idx_user_permissions_inheritance ON user_permissions(hierarchy_id, inherit_to_descendants) WHERE is_active = true;

-- Create indexes for roles
CREATE INDEX idx_roles_code ON roles(code);
CREATE INDEX idx_roles_level ON roles(level);
CREATE INDEX idx_roles_active ON roles(is_active);

-- Create indexes for role_permissions
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX idx_role_permissions_active ON role_permissions(is_active);

-- Create indexes for user_roles
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_hierarchy_id ON user_roles(hierarchy_id);
CREATE INDEX idx_user_roles_active ON user_roles(is_active);
CREATE INDEX idx_user_roles_validity ON user_roles(valid_from, valid_until);

-- Create GIN indexes for JSONB columns
CREATE INDEX idx_permissions_conditions ON permissions USING GIN (conditions);
CREATE INDEX idx_user_permissions_context ON user_permissions USING GIN (context_data);

-- Create triggers for updated_at
CREATE TRIGGER trigger_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_hierarchy_structures_updated_at();

CREATE TRIGGER trigger_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_hierarchy_structures_updated_at();

-- Create function to check permission hierarchy validity
CREATE OR REPLACE FUNCTION validate_permission_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure the hierarchy node exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM hierarchy_structures 
        WHERE id = NEW.hierarchy_id 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Cannot assign permission to inactive or non-existent hierarchy node';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for hierarchy validation
CREATE TRIGGER trigger_validate_user_permission_hierarchy
    BEFORE INSERT OR UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION validate_permission_hierarchy();

CREATE TRIGGER trigger_validate_user_role_hierarchy
    BEFORE INSERT OR UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION validate_permission_hierarchy();

-- Add comments for documentation
COMMENT ON TABLE permissions IS 'System permissions with resource-action-scope model';
COMMENT ON TABLE user_permissions IS 'User permissions with hierarchical context and inheritance';
COMMENT ON TABLE roles IS 'Role-based access control with hierarchical levels';
COMMENT ON TABLE role_permissions IS 'Permissions assigned to roles';
COMMENT ON TABLE user_roles IS 'Users assigned to roles with hierarchical context';

COMMENT ON COLUMN user_permissions.inherit_to_descendants IS 'Whether this permission applies to descendant hierarchy nodes';
COMMENT ON COLUMN user_permissions.inherit_from_ancestors IS 'Whether this permission is inherited from ancestor nodes';
COMMENT ON COLUMN user_permissions.is_explicit IS 'False for permissions inherited through hierarchy or roles';
COMMENT ON COLUMN user_permissions.context_data IS 'Additional permission context stored as JSONB';