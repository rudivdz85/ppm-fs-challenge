-- Migration 003: Create permissions table
-- Description: Creates the permissions table with foreign keys to users and hierarchy_structures
-- Dependencies: users and hierarchy_structures tables from previous migrations

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hierarchy_id UUID NOT NULL REFERENCES hierarchy_structures(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    inherit_to_descendants BOOLEAN NOT NULL DEFAULT false,
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT permissions_role_valid CHECK (role IN ('read', 'manager', 'admin')),
    CONSTRAINT permissions_expires_after_granted CHECK (expires_at IS NULL OR expires_at > granted_at),
    CONSTRAINT permissions_revoked_after_granted CHECK (revoked_at IS NULL OR revoked_at >= granted_at),
    CONSTRAINT permissions_active_not_revoked CHECK (
        (is_active = true AND revoked_at IS NULL) OR 
        (is_active = false AND revoked_at IS NOT NULL)
    ),
    CONSTRAINT permissions_revoked_has_revoker CHECK (
        (revoked_at IS NULL AND revoked_by IS NULL) OR 
        (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_hierarchy_id ON permissions (hierarchy_id);
CREATE INDEX IF NOT EXISTS idx_permissions_granted_by ON permissions (granted_by);
CREATE INDEX IF NOT EXISTS idx_permissions_revoked_by ON permissions (revoked_by);
CREATE INDEX IF NOT EXISTS idx_permissions_is_active ON permissions (is_active);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions (role);
CREATE INDEX IF NOT EXISTS idx_permissions_granted_at ON permissions (granted_at);
CREATE INDEX IF NOT EXISTS idx_permissions_expires_at ON permissions (expires_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_permissions_user_active ON permissions (user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_permissions_hierarchy_active ON permissions (hierarchy_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_permissions_user_hierarchy ON permissions (user_id, hierarchy_id);

-- Create unique constraint to prevent duplicate active permissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_user_hierarchy_active_unique 
ON permissions (user_id, hierarchy_id) 
WHERE is_active = true;

-- Create updated_at trigger function for permissions
CREATE OR REPLACE FUNCTION update_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_permissions_updated_at ON permissions;
CREATE TRIGGER trigger_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_permissions_updated_at();

-- Create function to revoke permission
CREATE OR REPLACE FUNCTION revoke_permission(
    permission_id UUID,
    revoker_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE permissions 
    SET 
        is_active = false,
        revoked_at = CURRENT_TIMESTAMP,
        revoked_by = revoker_id
    WHERE 
        id = permission_id 
        AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if permission is expired
CREATE OR REPLACE FUNCTION is_permission_expired(permission_row permissions)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN permission_row.expires_at IS NOT NULL AND permission_row.expires_at <= CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create view for active permissions (not revoked and not expired)
CREATE OR REPLACE VIEW active_permissions AS
SELECT 
    p.*,
    u.email as user_email,
    u.full_name as user_name,
    h.name as hierarchy_name,
    h.path as hierarchy_path,
    gb.email as granted_by_email,
    gb.full_name as granted_by_name
FROM permissions p
JOIN users u ON p.user_id = u.id
JOIN hierarchy_structures h ON p.hierarchy_id = h.id
JOIN users gb ON p.granted_by = gb.id
WHERE 
    p.is_active = true 
    AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP)
    AND u.is_active = true
    AND h.is_active = true;

-- Add comments for documentation
COMMENT ON TABLE permissions IS 'User permissions for hierarchy structures with role-based access control';
COMMENT ON COLUMN permissions.id IS 'Unique identifier for the permission';
COMMENT ON COLUMN permissions.user_id IS 'User who has this permission';
COMMENT ON COLUMN permissions.hierarchy_id IS 'Hierarchy structure this permission applies to';
COMMENT ON COLUMN permissions.role IS 'Permission level: read, manager, or admin';
COMMENT ON COLUMN permissions.inherit_to_descendants IS 'Whether permission applies to child hierarchy structures';
COMMENT ON COLUMN permissions.granted_by IS 'User who granted this permission';
COMMENT ON COLUMN permissions.granted_at IS 'Timestamp when permission was granted';
COMMENT ON COLUMN permissions.expires_at IS 'Optional expiration timestamp for temporary permissions';
COMMENT ON COLUMN permissions.revoked_at IS 'Timestamp when permission was revoked (if applicable)';
COMMENT ON COLUMN permissions.revoked_by IS 'User who revoked this permission (if applicable)';
COMMENT ON COLUMN permissions.is_active IS 'Whether this permission is currently active';
COMMENT ON COLUMN permissions.metadata IS 'Additional JSON metadata (reason, conditions, etc.)';
COMMENT ON COLUMN permissions.created_at IS 'Timestamp when the permission record was created';
COMMENT ON COLUMN permissions.updated_at IS 'Timestamp when the permission record was last updated';

COMMENT ON VIEW active_permissions IS 'View of currently active permissions with user and hierarchy details';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 003 completed: permissions table and views created successfully';
END $$;