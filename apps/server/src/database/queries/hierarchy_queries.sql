-- Common Hierarchy Queries
-- Collection of optimized SQL queries for hierarchical operations

-- =====================================
-- BASIC HIERARCHY QUERIES
-- =====================================

-- 1. Get all descendants of a node (including the node itself)
-- Usage: Get all locations under Sydney
SELECT h.*, nlevel(h.path) as depth
FROM hierarchy_structures h
WHERE h.path <@ 'australia.sydney'::ltree
  AND h.is_active = true
ORDER BY h.path;

-- 2. Get all ancestors of a node (including the node itself)
-- Usage: Get the full path from national to specific location
SELECT h.*, nlevel(h.path) as depth
FROM hierarchy_structures h
WHERE 'australia.sydney.cbd.sydney_city'::ltree ~ (h.path::text || '.*')::lquery
  AND h.is_active = true
ORDER BY h.path;

-- 3. Get immediate children of a node
-- Usage: Get direct subdivisions under Sydney
SELECT h.*
FROM hierarchy_structures h
WHERE h.path ~ 'australia.sydney.*{1}'::lquery
  AND h.is_active = true
ORDER BY h.sort_order, h.name;

-- 4. Get nodes at specific level under a parent
-- Usage: Get all level-2 nodes under Australia (cities)
SELECT h.*
FROM hierarchy_structures h
WHERE h.path <@ 'australia'::ltree
  AND h.level = 1
  AND h.is_active = true
ORDER BY h.sort_order, h.name;

-- 5. Get siblings of a node
-- Usage: Get other cities at same level as Sydney
WITH target_node AS (
  SELECT parent_id, level 
  FROM hierarchy_structures 
  WHERE code = 'sydney'
)
SELECT h.*
FROM hierarchy_structures h, target_node t
WHERE h.parent_id = t.parent_id
  AND h.level = t.level
  AND h.is_active = true
ORDER BY h.sort_order, h.name;

-- 6. Get leaf nodes (nodes with no children)
-- Usage: Find all locations that have no sub-locations
SELECT h.*
FROM hierarchy_structures h
WHERE h.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM hierarchy_structures child 
    WHERE child.parent_id = h.id AND child.is_active = true
  )
ORDER BY h.path;

-- 7. Get root nodes
-- Usage: Get top-level hierarchy entries
SELECT h.*
FROM hierarchy_structures h
WHERE h.parent_id IS NULL
  AND h.is_active = true
ORDER BY h.sort_order, h.name;

-- =====================================
-- HIERARCHY TREE QUERIES
-- =====================================

-- 8. Build complete hierarchy tree with user counts
-- Usage: Generate tree structure for UI display
WITH RECURSIVE hierarchy_tree AS (
  -- Root nodes
  SELECT 
    h.id, h.name, h.code, h.path, h.level, h.parent_id,
    0 as depth,
    ARRAY[h.sort_order] as sort_path,
    h.path::text as tree_path
  FROM hierarchy_structures h
  WHERE h.parent_id IS NULL AND h.is_active = true
  
  UNION ALL
  
  -- Recursive part
  SELECT 
    h.id, h.name, h.code, h.path, h.level, h.parent_id,
    t.depth + 1,
    t.sort_path || h.sort_order,
    t.tree_path || ' > ' || h.name
  FROM hierarchy_structures h
  JOIN hierarchy_tree t ON h.parent_id = t.id
  WHERE h.is_active = true
),
user_counts AS (
  SELECT 
    h.id as hierarchy_id,
    COUNT(u.id) as direct_user_count,
    COUNT(CASE WHEN desc_u.id IS NOT NULL THEN 1 END) as descendant_user_count
  FROM hierarchy_structures h
  LEFT JOIN users u ON u.base_hierarchy_id = h.id AND u.is_active = true
  LEFT JOIN hierarchy_structures desc_h ON desc_h.path <@ h.path AND desc_h.id != h.id
  LEFT JOIN users desc_u ON desc_u.base_hierarchy_id = desc_h.id AND desc_u.is_active = true
  GROUP BY h.id
)
SELECT 
  t.*,
  COALESCE(uc.direct_user_count, 0) as user_count,
  COALESCE(uc.descendant_user_count, 0) as total_user_count,
  CASE WHEN EXISTS (
    SELECT 1 FROM hierarchy_structures child 
    WHERE child.parent_id = t.id AND child.is_active = true
  ) THEN true ELSE false END as has_children
FROM hierarchy_tree t
LEFT JOIN user_counts uc ON t.id = uc.hierarchy_id
ORDER BY t.sort_path;

-- 9. Get hierarchy breadcrumb path
-- Usage: Display navigation breadcrumb for current location
CREATE OR REPLACE FUNCTION get_hierarchy_breadcrumb(node_path ltree)
RETURNS TABLE(
  id UUID,
  name VARCHAR(255),
  code VARCHAR(50),
  level INTEGER,
  path ltree
) AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.name, h.code, h.level, h.path
  FROM hierarchy_structures h
  WHERE node_path ~ (h.path::text || '.*')::lquery
    AND h.is_active = true
  ORDER BY h.level;
END;
$$ LANGUAGE plpgsql;

-- Usage example:
-- SELECT * FROM get_hierarchy_breadcrumb('australia.sydney.cbd.sydney_city'::ltree);

-- =====================================
-- USER-HIERARCHY QUERIES
-- =====================================

-- 10. Get users by hierarchy with inheritance
-- Usage: Find all users in Sydney region (including descendants)
WITH hierarchy_users AS (
  SELECT DISTINCT u.*
  FROM users u
  JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
  WHERE h.path <@ 'australia.sydney'::ltree
    AND u.is_active = true
    AND h.is_active = true
)
SELECT 
  u.*,
  h.name as hierarchy_name,
  h.path::text as hierarchy_path,
  h.level as hierarchy_level
FROM hierarchy_users u
JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
ORDER BY h.path, u.last_name, u.first_name;

-- 11. Get user's effective hierarchy scope
-- Usage: Determine all hierarchy nodes a user has access to
CREATE OR REPLACE FUNCTION get_user_hierarchy_scope(user_uuid UUID)
RETURNS TABLE(
  hierarchy_id UUID,
  hierarchy_name VARCHAR(255),
  hierarchy_path ltree,
  access_type VARCHAR(20),
  permission_source VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  -- Direct hierarchy assignment (user's base location)
  SELECT 
    h.id, h.name, h.path,
    'direct'::VARCHAR(20) as access_type,
    'base_location'::VARCHAR(50) as permission_source
  FROM hierarchy_structures h
  JOIN users u ON h.id = u.base_hierarchy_id
  WHERE u.id = user_uuid AND u.is_active = true AND h.is_active = true
  
  UNION
  
  -- Hierarchy access through permissions
  SELECT DISTINCT
    h.id, h.name, h.path,
    CASE 
      WHEN up.inherit_to_descendants THEN 'inherited'
      ELSE 'explicit'
    END::VARCHAR(20) as access_type,
    'permission'::VARCHAR(50) as permission_source
  FROM hierarchy_structures h
  JOIN user_permissions up ON h.id = up.hierarchy_id
  WHERE up.user_id = user_uuid 
    AND up.is_active = true 
    AND h.is_active = true
    AND (up.valid_until IS NULL OR up.valid_until > CURRENT_TIMESTAMP)
  
  UNION
  
  -- Hierarchy access through roles
  SELECT DISTINCT
    h.id, h.name, h.path,
    CASE 
      WHEN ur.inherit_to_descendants THEN 'inherited'
      ELSE 'explicit'
    END::VARCHAR(20) as access_type,
    'role'::VARCHAR(50) as permission_source
  FROM hierarchy_structures h
  JOIN user_roles ur ON h.id = ur.hierarchy_id
  WHERE ur.user_id = user_uuid 
    AND ur.is_active = true 
    AND h.is_active = true
    AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- HIERARCHY VALIDATION QUERIES
-- =====================================

-- 12. Validate hierarchy integrity
-- Usage: Check for common hierarchy issues
WITH hierarchy_issues AS (
  -- Check for orphaned nodes (parent_id points to non-existent node)
  SELECT 
    'orphaned_node' as issue_type,
    h.id,
    h.name,
    'Parent node does not exist' as description
  FROM hierarchy_structures h
  LEFT JOIN hierarchy_structures p ON h.parent_id = p.id
  WHERE h.parent_id IS NOT NULL AND p.id IS NULL
  
  UNION ALL
  
  -- Check for level inconsistencies
  SELECT 
    'level_inconsistency' as issue_type,
    h.id,
    h.name,
    'Level does not match parent level + 1' as description
  FROM hierarchy_structures h
  JOIN hierarchy_structures p ON h.parent_id = p.id
  WHERE h.level != p.level + 1
  
  UNION ALL
  
  -- Check for path inconsistencies
  SELECT 
    'path_inconsistency' as issue_type,
    h.id,
    h.name,
    'Path does not match parent path + code' as description
  FROM hierarchy_structures h
  JOIN hierarchy_structures p ON h.parent_id = p.id
  WHERE h.path != (p.path || h.code::ltree)
  
  UNION ALL
  
  -- Check for duplicate codes
  SELECT 
    'duplicate_code' as issue_type,
    h.id,
    h.name,
    'Code is not unique: ' || h.code as description
  FROM hierarchy_structures h
  WHERE EXISTS (
    SELECT 1 FROM hierarchy_structures h2 
    WHERE h2.code = h.code AND h2.id != h.id
  )
)
SELECT * FROM hierarchy_issues
ORDER BY issue_type, name;

-- =====================================
-- PERFORMANCE ANALYSIS QUERIES
-- =====================================

-- 13. Hierarchy statistics
-- Usage: Get overview of hierarchy structure and usage
SELECT 
  'Total Nodes' as metric,
  COUNT(*)::text as value
FROM hierarchy_structures
WHERE is_active = true

UNION ALL

SELECT 
  'Max Depth' as metric,
  MAX(level)::text as value
FROM hierarchy_structures
WHERE is_active = true

UNION ALL

SELECT 
  'Root Nodes' as metric,
  COUNT(*)::text as value
FROM hierarchy_structures
WHERE parent_id IS NULL AND is_active = true

UNION ALL

SELECT 
  'Leaf Nodes' as metric,
  COUNT(*)::text as value
FROM hierarchy_structures h
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM hierarchy_structures child 
    WHERE child.parent_id = h.id AND child.is_active = true
  )

UNION ALL

SELECT 
  'Users Assigned' as metric,
  COUNT(DISTINCT u.id)::text as value
FROM users u
JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
WHERE u.is_active = true AND h.is_active = true;

-- 14. Query performance analysis
-- Usage: Analyze query performance for optimization
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT h.*, COUNT(u.id) as user_count
FROM hierarchy_structures h
LEFT JOIN hierarchy_structures desc ON desc.path <@ h.path
LEFT JOIN users u ON u.base_hierarchy_id = desc.id
WHERE h.path <@ 'australia.sydney'::ltree
  AND h.is_active = true
GROUP BY h.id, h.name, h.path, h.level
ORDER BY h.path;

-- =====================================
-- PERFORMANCE INDEXES
-- =====================================

-- 15. Essential indexes for optimal performance
-- Usage: Run these after schema creation for best query performance

-- Primary ltree indexes (most important)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hierarchy_path_gist 
ON hierarchy_structures USING GIST (path);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hierarchy_path_btree 
ON hierarchy_structures (path);

-- Partial indexes for active records only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hierarchy_active_path 
ON hierarchy_structures (path) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hierarchy_active_parent 
ON hierarchy_structures (parent_id) WHERE is_active = true;

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hierarchy_level_path 
ON hierarchy_structures (level, path) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hierarchy_parent_sort 
ON hierarchy_structures (parent_id, sort_order, name) WHERE is_active = true;

-- User-hierarchy relationship indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_base_hierarchy 
ON users (base_hierarchy_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users (email) WHERE is_active = true;

-- Permission system indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_active 
ON user_permissions (user_id, hierarchy_id, permission_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_hierarchy 
ON user_permissions (hierarchy_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_active 
ON user_roles (user_id, hierarchy_id, role_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permissions_active 
ON role_permissions (role_id, permission_id) WHERE is_active = true;

-- Temporal permission indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_validity 
ON user_permissions (valid_from, valid_until) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_validity 
ON user_roles (valid_from, valid_until) WHERE is_active = true;

-- JSONB indexes for metadata and conditions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hierarchy_metadata_gin 
ON hierarchy_structures USING GIN (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permissions_conditions_gin 
ON permissions USING GIN (conditions);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_context_gin 
ON user_permissions USING GIN (context_data);

-- =====================================
-- OPTIMIZED PERMISSION CHECK FUNCTIONS
-- =====================================

-- 16. High-performance permission checking function
-- Usage: Optimized for real-time permission validation
CREATE OR REPLACE FUNCTION check_user_permission_fast(
  p_user_id UUID,
  p_resource VARCHAR(100),
  p_action permission_action,
  p_hierarchy_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  target_path LTREE;
  has_permission BOOLEAN := FALSE;
BEGIN
  -- Get target hierarchy path for inheritance checks
  SELECT path INTO target_path 
  FROM hierarchy_structures 
  WHERE id = p_hierarchy_id AND is_active = true;
  
  IF target_path IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check direct user permissions (most common case first)
  SELECT EXISTS (
    SELECT 1 
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    JOIN hierarchy_structures h ON up.hierarchy_id = h.id
    WHERE up.user_id = p_user_id
      AND up.is_active = true
      AND p.resource = p_resource
      AND p.action = p_action
      AND h.is_active = true
      AND (up.valid_until IS NULL OR up.valid_until > CURRENT_TIMESTAMP)
      AND (
        h.id = p_hierarchy_id OR
        (up.inherit_to_descendants = true AND target_path <@ h.path)
      )
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;

  -- Check role-based permissions
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    JOIN hierarchy_structures h ON ur.hierarchy_id = h.id
    WHERE ur.user_id = p_user_id
      AND ur.is_active = true
      AND rp.is_active = true
      AND p.resource = p_resource
      AND p.action = p_action
      AND h.is_active = true
      AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP)
      AND (
        h.id = p_hierarchy_id OR
        (ur.inherit_to_descendants = true AND target_path <@ h.path)
      )
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql STABLE;

-- 17. Bulk permission check for UI optimization
-- Usage: Check multiple permissions at once for dashboard/menu rendering
CREATE OR REPLACE FUNCTION check_user_permissions_bulk(
  p_user_id UUID,
  p_permissions JSONB, -- [{"resource": "users", "action": "read", "hierarchy_id": "uuid"}]
  p_hierarchy_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  permission_record JSONB;
  result JSONB := '{}';
  permission_key TEXT;
  has_permission BOOLEAN;
  target_hierarchy UUID;
BEGIN
  FOR permission_record IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    target_hierarchy := COALESCE(
      (permission_record->>'hierarchy_id')::UUID,
      p_hierarchy_id
    );
    
    permission_key := permission_record->>'resource' || ':' || permission_record->>'action';
    
    SELECT check_user_permission_fast(
      p_user_id,
      permission_record->>'resource',
      (permission_record->>'action')::permission_action,
      target_hierarchy
    ) INTO has_permission;
    
    result := result || jsonb_build_object(permission_key, has_permission);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================
-- CACHE WARMING QUERIES
-- =====================================

-- 18. Warm up permission cache
-- Usage: Run periodically to keep frequently accessed data in memory
PREPARE warm_permission_cache AS
SELECT 
  up.user_id,
  up.hierarchy_id,
  up.permission_id,
  p.resource,
  p.action,
  h.path
FROM user_permissions up
JOIN permissions p ON up.permission_id = p.id
JOIN hierarchy_structures h ON up.hierarchy_id = h.id
WHERE up.is_active = true
  AND (up.valid_until IS NULL OR up.valid_until > CURRENT_TIMESTAMP);

-- 19. Hierarchy statistics for monitoring
-- Usage: Monitor hierarchy health and usage patterns
CREATE OR REPLACE VIEW hierarchy_health_stats AS
WITH hierarchy_metrics AS (
  SELECT 
    COUNT(*) as total_nodes,
    COUNT(*) FILTER (WHERE parent_id IS NULL) as root_nodes,
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM hierarchy_structures child 
      WHERE child.parent_id = hierarchy_structures.id
    )) as leaf_nodes,
    MAX(level) as max_depth,
    AVG(level) as avg_depth
  FROM hierarchy_structures 
  WHERE is_active = true
),
user_distribution AS (
  SELECT 
    h.level,
    COUNT(u.id) as user_count
  FROM hierarchy_structures h
  LEFT JOIN users u ON u.base_hierarchy_id = h.id AND u.is_active = true
  WHERE h.is_active = true
  GROUP BY h.level
)
SELECT 
  hm.*,
  json_agg(
    json_build_object(
      'level', ud.level,
      'user_count', ud.user_count
    ) ORDER BY ud.level
  ) as users_by_level
FROM hierarchy_metrics hm, user_distribution ud
GROUP BY hm.total_nodes, hm.root_nodes, hm.leaf_nodes, hm.max_depth, hm.avg_depth;