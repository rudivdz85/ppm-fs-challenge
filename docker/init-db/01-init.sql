-- Initialize the PPM Challenge database
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    avatar TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'own',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (role_id, permission_id)
);

-- Create hierarchies table
CREATE TABLE IF NOT EXISTS hierarchies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'organizational',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create hierarchy_levels table
CREATE TABLE IF NOT EXISTS hierarchy_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hierarchy_id UUID REFERENCES hierarchies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL,
    parent_id UUID REFERENCES hierarchy_levels(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hierarchy_id, level, name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_hierarchy_levels_hierarchy_id ON hierarchy_levels(hierarchy_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_levels_parent_id ON hierarchy_levels(parent_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_levels_level ON hierarchy_levels(level);

-- Insert default roles
INSERT INTO roles (id, name, description, level) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Super Admin', 'Full system access', 100),
    ('00000000-0000-0000-0000-000000000002', 'Admin', 'Administrative access', 80),
    ('00000000-0000-0000-0000-000000000003', 'Manager', 'Management level access', 60),
    ('00000000-0000-0000-0000-000000000004', 'User', 'Standard user access', 40),
    ('00000000-0000-0000-0000-000000000005', 'Guest', 'Limited read-only access', 20)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (id, name, description, resource, action, scope) VALUES
    -- User permissions
    ('10000000-0000-0000-0000-000000000001', 'Create Users', 'Create new user accounts', 'users', 'create', 'global'),
    ('10000000-0000-0000-0000-000000000002', 'Read Users', 'View user information', 'users', 'read', 'global'),
    ('10000000-0000-0000-0000-000000000003', 'Update Users', 'Modify user accounts', 'users', 'update', 'global'),
    ('10000000-0000-0000-0000-000000000004', 'Delete Users', 'Remove user accounts', 'users', 'delete', 'global'),
    
    -- Role permissions
    ('20000000-0000-0000-0000-000000000001', 'Manage Roles', 'Create, update, delete roles', 'roles', 'manage', 'global'),
    ('20000000-0000-0000-0000-000000000002', 'Assign Roles', 'Assign roles to users', 'roles', 'assign', 'global'),
    
    -- Permission permissions
    ('30000000-0000-0000-0000-000000000001', 'Manage Permissions', 'Create, update, delete permissions', 'permissions', 'manage', 'global'),
    
    -- System permissions
    ('90000000-0000-0000-0000-000000000001', 'System Admin', 'Full system administration', 'system', 'manage', 'global')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id) VALUES
    -- Super Admin gets all permissions
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003'),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004'),
    ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001'),
    
    -- Admin gets user and role management
    ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'),
    ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
    
    -- User gets basic read permissions
    ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hierarchies_updated_at BEFORE UPDATE ON hierarchies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hierarchy_levels_updated_at BEFORE UPDATE ON hierarchy_levels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create default admin user (password will need to be hashed in application)
INSERT INTO users (id, email, first_name, last_name, display_name, is_active) VALUES
    ('99999999-9999-9999-9999-999999999999', 'admin@ppm-challenge.local', 'System', 'Administrator', 'Admin', true)
ON CONFLICT (email) DO NOTHING;

-- Assign super admin role to default admin user
INSERT INTO user_roles (user_id, role_id) VALUES
    ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, role_id) DO NOTHING;