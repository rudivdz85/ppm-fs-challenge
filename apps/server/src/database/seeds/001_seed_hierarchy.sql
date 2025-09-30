-- Seed Script: 001_seed_hierarchy.sql
-- Description: Seed example hierarchical data (National > City > Suburb structure)
-- Author: PPM FS Challenge
-- Created: 2025-09-29

-- Clear existing data (for development/testing only)
-- TRUNCATE TABLE user_permissions, user_roles, role_permissions, users, roles, permissions, hierarchy_structures CASCADE;

-- Insert root level: National
INSERT INTO hierarchy_structures (id, name, code, description, path, parent_id, level, sort_order, metadata) VALUES
    ('00000000-1111-1111-1111-111111111111', 'Australia', 'australia', 'National level - Australia', 'australia', NULL, 0, 0, '{"country_code": "AU", "timezone": "Australia/Sydney"}')
ON CONFLICT (code) DO NOTHING;

-- Insert second level: Cities
INSERT INTO hierarchy_structures (id, name, code, description, path, parent_id, level, sort_order, metadata) VALUES
    ('00000000-2222-1111-1111-111111111111', 'Sydney', 'sydney', 'Major city - Sydney, NSW', 'australia.sydney', '00000000-1111-1111-1111-111111111111', 1, 1, '{"state": "NSW", "population": 5312000, "timezone": "Australia/Sydney"}'),
    ('00000000-2222-2222-1111-111111111111', 'Melbourne', 'melbourne', 'Major city - Melbourne, VIC', 'australia.melbourne', '00000000-1111-1111-1111-111111111111', 1, 2, '{"state": "VIC", "population": 5078000, "timezone": "Australia/Melbourne"}'),
    ('00000000-2222-3333-1111-111111111111', 'Brisbane', 'brisbane', 'Major city - Brisbane, QLD', 'australia.brisbane', '00000000-1111-1111-1111-111111111111', 1, 3, '{"state": "QLD", "population": 2560000, "timezone": "Australia/Brisbane"}'),
    ('00000000-2222-4444-1111-111111111111', 'Perth', 'perth', 'Major city - Perth, WA', 'australia.perth', '00000000-1111-1111-1111-111111111111', 1, 4, '{"state": "WA", "population": 2192000, "timezone": "Australia/Perth"}')
ON CONFLICT (code) DO NOTHING;

-- Insert third level: Sydney Suburbs
INSERT INTO hierarchy_structures (id, name, code, description, path, parent_id, level, sort_order, metadata) VALUES
    ('00000000-3333-1111-1111-111111111111', 'CBD & Surrounds', 'sydney_cbd', 'Sydney Central Business District', 'australia.sydney.sydney_cbd', '00000000-2222-1111-1111-111111111111', 2, 1, '{"postcode_range": "2000-2009", "area_type": "commercial"}'),
    ('00000000-3333-1112-1111-111111111111', 'Eastern Suburbs', 'sydney_eastern', 'Sydney Eastern Suburbs', 'australia.sydney.sydney_eastern', '00000000-2222-1111-1111-111111111111', 2, 2, '{"postcode_range": "2021-2031", "area_type": "residential"}'),
    ('00000000-3333-1113-1111-111111111111', 'Northern Beaches', 'sydney_northern_beaches', 'Sydney Northern Beaches', 'australia.sydney.sydney_northern_beaches', '00000000-2222-1111-1111-111111111111', 2, 3, '{"postcode_range": "2097-2108", "area_type": "coastal"}'),
    ('00000000-3333-1114-1111-111111111111', 'Inner West', 'sydney_inner_west', 'Sydney Inner West', 'australia.sydney.sydney_inner_west', '00000000-2222-1111-1111-111111111111', 2, 4, '{"postcode_range": "2038-2050", "area_type": "mixed"}'),
    ('00000000-3333-1115-1111-111111111111', 'Western Suburbs', 'sydney_western', 'Sydney Western Suburbs', 'australia.sydney.sydney_western', '00000000-2222-1111-1111-111111111111', 2, 5, '{"postcode_range": "2145-2770", "area_type": "suburban"}'
)
ON CONFLICT (code) DO NOTHING;

-- Insert third level: Melbourne Suburbs
INSERT INTO hierarchy_structures (id, name, code, description, path, parent_id, level, sort_order, metadata) VALUES
    ('00000000-3333-2221-1111-111111111111', 'Melbourne CBD', 'melbourne_cbd', 'Melbourne Central Business District', 'australia.melbourne.melbourne_cbd', '00000000-2222-2222-1111-111111111111', 2, 1, '{"postcode_range": "3000-3006", "area_type": "commercial"}'),
    ('00000000-3333-2222-1111-111111111111', 'Inner Melbourne', 'melbourne_inner', 'Inner Melbourne Suburbs', 'australia.melbourne.melbourne_inner', '00000000-2222-2222-1111-111111111111', 2, 2, '{"postcode_range": "3065-3182", "area_type": "residential"}'),
    ('00000000-3333-2223-1111-111111111111', 'Bayside', 'melbourne_bayside', 'Melbourne Bayside Suburbs', 'australia.melbourne.melbourne_bayside', '00000000-2222-2222-1111-111111111111', 2, 3, '{"postcode_range": "3183-3199", "area_type": "coastal"}'),
    ('00000000-3333-2224-1111-111111111111', 'Eastern Melbourne', 'melbourne_eastern', 'Eastern Melbourne Suburbs', 'australia.melbourne.melbourne_eastern', '00000000-2222-2222-1111-111111111111', 2, 4, '{"postcode_range": "3124-3200", "area_type": "suburban"}'
)
ON CONFLICT (code) DO NOTHING;

-- Insert fourth level: Specific suburbs under Sydney CBD
INSERT INTO hierarchy_structures (id, name, code, description, path, parent_id, level, sort_order, metadata) VALUES
    ('00000000-4444-1111-1111-111111111111', 'Sydney City', 'sydney_city', 'Sydney City Centre (2000)', 'australia.sydney.sydney_cbd.sydney_city', '00000000-3333-1111-1111-111111111111', 3, 1, '{"postcode": "2000", "landmark": "Sydney Harbour Bridge"}'),
    ('00000000-4444-1112-1111-111111111111', 'The Rocks', 'the_rocks', 'The Rocks Historic Area (2000)', 'australia.sydney.sydney_cbd.the_rocks', '00000000-3333-1111-1111-111111111111', 3, 2, '{"postcode": "2000", "landmark": "Sydney Opera House"}'),
    ('00000000-4444-1113-1111-111111111111', 'Darling Harbour', 'darling_harbour', 'Darling Harbour Entertainment District (2000)', 'australia.sydney.sydney_cbd.darling_harbour', '00000000-3333-1111-1111-111111111111', 3, 3, '{"postcode": "2000", "landmark": "Darling Harbour Convention Centre"}')
ON CONFLICT (code) DO NOTHING;

-- Insert basic permissions
INSERT INTO permissions (id, name, code, description, resource, action, scope, is_system_permission) VALUES
    ('10000000-1111-1111-1111-111111111111', 'View Users', 'view_users', 'View user information', 'users', 'read', 'own', false),
    ('10000000-1111-1111-1111-111111111112', 'Manage Users', 'manage_users', 'Full user management capabilities', 'users', 'manage', 'organization', true),
    ('10000000-1111-1111-1111-111111111113', 'View Reports', 'view_reports', 'View reports and analytics', 'reports', 'read', 'team', false),
    ('10000000-1111-1111-1111-111111111114', 'Manage Reports', 'manage_reports', 'Create and manage reports', 'reports', 'manage', 'region', false),
    ('10000000-1111-1111-1111-111111111115', 'System Admin', 'system_admin', 'Full system administration', 'system', 'manage', 'system', true),
    ('10000000-1111-1111-1111-111111111116', 'View Hierarchy', 'view_hierarchy', 'View organizational hierarchy', 'hierarchy', 'read', 'own', false),
    ('10000000-1111-1111-1111-111111111117', 'Manage Hierarchy', 'manage_hierarchy', 'Manage organizational structure', 'hierarchy', 'manage', 'organization', true)
ON CONFLICT (code) DO NOTHING;

-- Insert basic roles
INSERT INTO roles (id, name, code, description, level, is_system_role) VALUES
    ('20000000-1111-1111-1111-111111111111', 'System Administrator', 'system_admin', 'Full system access', 100, true),
    ('20000000-1111-1111-1111-111111111112', 'Regional Manager', 'regional_manager', 'Regional level management', 80, false),
    ('20000000-1111-1111-1111-111111111113', 'City Manager', 'city_manager', 'City level management', 60, false),
    ('20000000-1111-1111-1111-111111111114', 'Area Supervisor', 'area_supervisor', 'Area/suburb level supervision', 40, false),
    ('20000000-1111-1111-1111-111111111115', 'Standard User', 'standard_user', 'Basic user access', 20, false)
ON CONFLICT (code) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id, is_active, inherit_to_descendants) VALUES
    -- System Administrator gets all permissions
    ('20000000-1111-1111-1111-111111111111', '10000000-1111-1111-1111-111111111111', true, true),
    ('20000000-1111-1111-1111-111111111111', '10000000-1111-1111-1111-111111111112', true, true),
    ('20000000-1111-1111-1111-111111111111', '10000000-1111-1111-1111-111111111113', true, true),
    ('20000000-1111-1111-1111-111111111111', '10000000-1111-1111-1111-111111111114', true, true),
    ('20000000-1111-1111-1111-111111111111', '10000000-1111-1111-1111-111111111115', true, true),
    ('20000000-1111-1111-1111-111111111111', '10000000-1111-1111-1111-111111111116', true, true),
    ('20000000-1111-1111-1111-111111111111', '10000000-1111-1111-1111-111111111117', true, true),
    
    -- Regional Manager gets user and report management
    ('20000000-1111-1111-1111-111111111112', '10000000-1111-1111-1111-111111111111', true, true),
    ('20000000-1111-1111-1111-111111111112', '10000000-1111-1111-1111-111111111112', true, true),
    ('20000000-1111-1111-1111-111111111112', '10000000-1111-1111-1111-111111111113', true, true),
    ('20000000-1111-1111-1111-111111111112', '10000000-1111-1111-1111-111111111114', true, true),
    ('20000000-1111-1111-1111-111111111112', '10000000-1111-1111-1111-111111111116', true, true),
    
    -- City Manager gets view and limited management
    ('20000000-1111-1111-1111-111111111113', '10000000-1111-1111-1111-111111111111', true, true),
    ('20000000-1111-1111-1111-111111111113', '10000000-1111-1111-1111-111111111113', true, true),
    ('20000000-1111-1111-1111-111111111113', '10000000-1111-1111-1111-111111111114', true, true),
    ('20000000-1111-1111-1111-111111111113', '10000000-1111-1111-1111-111111111116', true, true),
    
    -- Area Supervisor gets basic access
    ('20000000-1111-1111-1111-111111111114', '10000000-1111-1111-1111-111111111111', true, true),
    ('20000000-1111-1111-1111-111111111114', '10000000-1111-1111-1111-111111111113', true, true),
    ('20000000-1111-1111-1111-111111111114', '10000000-1111-1111-1111-111111111116', true, true),
    
    -- Standard User gets view only
    ('20000000-1111-1111-1111-111111111115', '10000000-1111-1111-1111-111111111111', true, false),
    ('20000000-1111-1111-1111-111111111115', '10000000-1111-1111-1111-111111111113', true, false),
    ('20000000-1111-1111-1111-111111111115', '10000000-1111-1111-1111-111111111116', true, false)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Insert sample users (passwords will need to be hashed in application)
INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, base_hierarchy_id, is_active, is_verified, timezone, locale) VALUES
    ('30000000-1111-1111-1111-111111111111', 'admin@ppm.local', '$2b$10$placeholder_hash_for_development', 'System', 'Administrator', 'Admin', '00000000-1111-1111-1111-111111111111', true, true, 'Australia/Sydney', 'en'),
    ('30000000-1111-1111-1111-111111111112', 'sydney.manager@ppm.local', '$2b$10$placeholder_hash_for_development', 'Sarah', 'Chen', 'Sarah Chen', '00000000-2222-1111-1111-111111111111', true, true, 'Australia/Sydney', 'en'),
    ('30000000-1111-1111-1111-111111111113', 'melbourne.manager@ppm.local', '$2b$10$placeholder_hash_for_development', 'Michael', 'Thompson', 'Mike Thompson', '00000000-2222-2222-1111-111111111111', true, true, 'Australia/Melbourne', 'en'),
    ('30000000-1111-1111-1111-111111111114', 'cbd.supervisor@ppm.local', '$2b$10$placeholder_hash_for_development', 'Jessica', 'Wong', 'Jess Wong', '00000000-3333-1111-1111-111111111111', true, true, 'Australia/Sydney', 'en'),
    ('30000000-1111-1111-1111-111111111115', 'user.cbd@ppm.local', '$2b$10$placeholder_hash_for_development', 'David', 'Smith', 'Dave Smith', '00000000-4444-1111-1111-111111111111', true, true, 'Australia/Sydney', 'en'),
    ('30000000-1111-1111-1111-111111111116', 'user.rocks@ppm.local', '$2b$10$placeholder_hash_for_development', 'Emma', 'Johnson', 'Emma J', '00000000-4444-1112-1111-111111111111', true, true, 'Australia/Sydney', 'en')
ON CONFLICT (email) DO NOTHING;

-- Assign roles to users with hierarchy context
INSERT INTO user_roles (user_id, role_id, hierarchy_id, inherit_to_descendants, assigned_by) VALUES
    -- System admin at national level
    ('30000000-1111-1111-1111-111111111111', '20000000-1111-1111-1111-111111111111', '00000000-1111-1111-1111-111111111111', true, '30000000-1111-1111-1111-111111111111'),
    
    -- Regional managers at city level
    ('30000000-1111-1111-1111-111111111112', '20000000-1111-1111-1111-111111111112', '00000000-2222-1111-1111-111111111111', true, '30000000-1111-1111-1111-111111111111'),
    ('30000000-1111-1111-1111-111111111113', '20000000-1111-1111-1111-111111111112', '00000000-2222-2222-1111-111111111111', true, '30000000-1111-1111-1111-111111111111'),
    
    -- Area supervisor at suburb level
    ('30000000-1111-1111-1111-111111111114', '20000000-1111-1111-1111-111111111114', '00000000-3333-1111-1111-111111111111', true, '30000000-1111-1111-1111-111111111112'),
    
    -- Standard users at specific locations
    ('30000000-1111-1111-1111-111111111115', '20000000-1111-1111-1111-111111111115', '00000000-4444-1111-1111-111111111111', false, '30000000-1111-1111-1111-111111111114'),
    ('30000000-1111-1111-1111-111111111116', '20000000-1111-1111-1111-111111111115', '00000000-4444-1112-1111-111111111111', false, '30000000-1111-1111-1111-111111111114')
ON CONFLICT (user_id, role_id, hierarchy_id) DO NOTHING;

-- Grant some specific permissions (examples of direct permission grants)
INSERT INTO user_permissions (user_id, permission_id, hierarchy_id, inherit_to_descendants, granted_by, context_data) VALUES
    -- Give Sydney manager special report access to Brisbane
    ('30000000-1111-1111-1111-111111111112', '10000000-1111-1111-1111-111111111114', '00000000-2222-3333-1111-111111111111', false, '30000000-1111-1111-1111-111111111111', '{"reason": "Temporary project assignment", "project": "Cross-city analytics"}'),
    
    -- Give CBD supervisor user management rights within their area
    ('30000000-1111-1111-1111-111111111114', '10000000-1111-1111-1111-111111111112', '00000000-3333-1111-1111-111111111111', true, '30000000-1111-1111-1111-111111111112', '{"scope": "CBD area only", "delegation": true}')
ON CONFLICT (user_id, permission_id, hierarchy_id) DO NOTHING;

-- Update audit fields where possible (set created_by for initial data)
UPDATE hierarchy_structures SET created_by = '30000000-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE permissions SET created_by = '30000000-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE roles SET created_by = '30000000-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE role_permissions SET created_by = '30000000-1111-1111-1111-111111111111' WHERE created_by IS NULL;

-- Verify the hierarchy structure
-- This query should show the complete hierarchy tree
/*
SELECT 
    h.name,
    h.code,
    h.level,
    h.path::text as path,
    p.name as parent_name
FROM hierarchy_structures h
LEFT JOIN hierarchy_structures p ON h.parent_id = p.id
ORDER BY h.path;
*/

-- Add some useful comments for future reference
COMMENT ON TABLE hierarchy_structures IS 'Organizational hierarchy using materialized path (ltree) - supports National > City > Suburb > Location structure';
COMMENT ON TABLE users IS 'Users are assigned to their base hierarchy location (usually the lowest/most specific level)';
COMMENT ON TABLE user_permissions IS 'Permissions can be granted at any hierarchy level with inheritance controls';
COMMENT ON TABLE user_roles IS 'Roles are assigned with hierarchy context and can inherit to descendants';