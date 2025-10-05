-- Migration 004: Create additional performance indexes
-- Description: Creates additional indexes for optimal query performance
-- Dependencies: All previous migrations

-- Additional hierarchy_structures indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_hierarchy_ancestors ON hierarchy_structures USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_hierarchy_descendants ON hierarchy_structures (path) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hierarchy_name_search ON hierarchy_structures USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_hierarchy_description_search ON hierarchy_structures USING GIN (to_tsvector('english', description)) WHERE description IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hierarchy_metadata ON hierarchy_structures USING GIN (metadata);

-- Composite indexes for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_hierarchy_parent_active ON hierarchy_structures (parent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hierarchy_level_active ON hierarchy_structures (level, is_active);

-- Additional users indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_users_name_search ON users USING GIN (to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_users_email_search ON users (email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_metadata ON users USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL;

-- Composite indexes for user queries
CREATE INDEX IF NOT EXISTS idx_users_hierarchy_active_name ON users (base_hierarchy_id, is_active, full_name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_created_active ON users (created_at, is_active) WHERE is_active = true;

-- Additional permissions indexes for access control queries
CREATE INDEX IF NOT EXISTS idx_permissions_role_active ON permissions (role, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_permissions_inherit_active ON permissions (inherit_to_descendants, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_permissions_expires_active ON permissions (expires_at, is_active) WHERE is_active = true AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_permissions_granted_date ON permissions (granted_at, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_permissions_metadata ON permissions USING GIN (metadata);

-- Composite indexes for permission hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_permissions_user_role_active ON permissions (user_id, role, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_permissions_hierarchy_role_active ON permissions (hierarchy_id, role, is_active) WHERE is_active = true;

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS migrations_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    
    CONSTRAINT migrations_log_name_not_empty CHECK (LENGTH(TRIM(migration_name)) > 0)
);

-- Create index on migration log
CREATE INDEX IF NOT EXISTS idx_migrations_log_executed_at ON migrations_log (executed_at);
CREATE INDEX IF NOT EXISTS idx_migrations_log_success ON migrations_log (success);

-- Create function to log migration execution
CREATE OR REPLACE FUNCTION log_migration_execution(
    migration_name VARCHAR(255),
    execution_time_ms INTEGER DEFAULT NULL,
    success BOOLEAN DEFAULT true,
    error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO migrations_log (migration_name, execution_time_ms, success, error_message)
    VALUES (migration_name, execution_time_ms, success, error_message)
    ON CONFLICT (migration_name) DO UPDATE SET
        executed_at = CURRENT_TIMESTAMP,
        execution_time_ms = EXCLUDED.execution_time_ms,
        success = EXCLUDED.success,
        error_message = EXCLUDED.error_message;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if migration has been executed
CREATE OR REPLACE FUNCTION has_migration_been_executed(migration_name VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM migrations_log 
        WHERE migration_name = $1 AND success = true
    );
END;
$$ LANGUAGE plpgsql;

-- Create comprehensive view for user access analysis
CREATE OR REPLACE VIEW user_access_analysis AS
WITH user_hierarchies AS (
    -- Get all hierarchies a user can access through permissions
    SELECT DISTINCT
        p.user_id,
        h.id as hierarchy_id,
        h.name as hierarchy_name,
        h.path as hierarchy_path,
        h.level as hierarchy_depth,
        p.role,
        p.inherit_to_descendants,
        p.granted_at
    FROM active_permissions p
    JOIN hierarchy_structures h ON p.hierarchy_id = h.id
    WHERE h.is_active = true
),
inherited_access AS (
    -- Get access to descendant hierarchies when inherit_to_descendants is true
    SELECT DISTINCT
        uh.user_id,
        h.id as hierarchy_id,
        h.name as hierarchy_name,
        h.path as hierarchy_path,
        h.level as hierarchy_depth,
        uh.role,
        'inherited' as access_type
    FROM user_hierarchies uh
    JOIN hierarchy_structures h ON h.path <@ uh.hierarchy_path
    WHERE uh.inherit_to_descendants = true
        AND h.id != uh.hierarchy_id
        AND h.is_active = true
)
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.base_hierarchy_id,
    uh.hierarchy_id,
    uh.hierarchy_name,
    uh.hierarchy_path,
    uh.hierarchy_depth,
    uh.role,
    COALESCE(ia.access_type, 'direct') as access_type,
    uh.granted_at
FROM users u
JOIN user_hierarchies uh ON u.id = uh.user_id
LEFT JOIN inherited_access ia ON u.id = ia.user_id AND uh.hierarchy_id = ia.hierarchy_id
WHERE u.is_active = true

UNION

SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.base_hierarchy_id,
    ia.hierarchy_id,
    ia.hierarchy_name,
    ia.hierarchy_path,
    ia.hierarchy_depth,
    ia.role,
    ia.access_type,
    NULL as granted_at
FROM users u
JOIN inherited_access ia ON u.id = ia.user_id
WHERE u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM user_hierarchies uh 
        WHERE uh.user_id = u.id AND uh.hierarchy_id = ia.hierarchy_id
    );

-- Create view for hierarchy statistics
CREATE OR REPLACE VIEW hierarchy_statistics AS
SELECT 
    h.id,
    h.name,
    h.path,
    h.level,
    h.is_active,
    COUNT(DISTINCT u.id) as direct_user_count,
    COUNT(DISTINCT p.id) as permission_count,
    COUNT(DISTINCT CASE WHEN p.role = 'admin' THEN p.id END) as admin_permission_count,
    COUNT(DISTINCT CASE WHEN p.role = 'manager' THEN p.id END) as manager_permission_count,
    COUNT(DISTINCT CASE WHEN p.role = 'read' THEN p.id END) as read_permission_count,
    COUNT(DISTINCT child.id) as direct_child_count,
    h.created_at,
    h.updated_at
FROM hierarchy_structures h
LEFT JOIN users u ON h.id = u.base_hierarchy_id AND u.is_active = true
LEFT JOIN active_permissions p ON h.id = p.hierarchy_id
LEFT JOIN hierarchy_structures child ON h.id = child.parent_id AND child.is_active = true
WHERE h.is_active = true
GROUP BY h.id, h.name, h.path, h.level, h.is_active, h.created_at, h.updated_at;

-- Add comments for new objects
COMMENT ON TABLE migrations_log IS 'Tracks executed database migrations';
COMMENT ON VIEW user_access_analysis IS 'Comprehensive view of user access to hierarchy structures including inherited permissions';
COMMENT ON VIEW hierarchy_statistics IS 'Statistical information about hierarchy structures including user and permission counts';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 004 completed: Performance indexes and analysis views created successfully';
END $$;