-- Migration: 002_create_users.sql
-- Description: Create users table with reference to hierarchy structures
-- Author: PPM FS Challenge
-- Created: 2025-09-29

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic user information
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    avatar_url TEXT,
    
    -- User status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_system_user BOOLEAN NOT NULL DEFAULT false, -- For system/service accounts
    
    -- Hierarchy reference - user's base location (lowest level)
    base_hierarchy_id UUID NOT NULL REFERENCES hierarchy_structures(id) ON DELETE RESTRICT,
    
    -- Authentication and security
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- Profile information
    phone VARCHAR(50),
    timezone VARCHAR(100) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- Self-referencing for audit trail
    updated_by UUID, -- Self-referencing for audit trail
    
    -- Additional profile data as JSON
    profile_data JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_failed_attempts_check CHECK (failed_login_attempts >= 0),
    CONSTRAINT users_names_not_empty CHECK (
        LENGTH(TRIM(first_name)) > 0 AND 
        LENGTH(TRIM(last_name)) > 0
    )
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_base_hierarchy_id ON users(base_hierarchy_id);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_verified ON users(is_verified);
CREATE INDEX idx_users_last_login ON users(last_login_at);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_display_name ON users(display_name);

-- Create partial indexes for common query patterns
CREATE INDEX idx_users_active_verified ON users(base_hierarchy_id) WHERE is_active = true AND is_verified = true;
CREATE INDEX idx_users_locked ON users(id) WHERE locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP;

-- Create GIN index for profile_data JSONB queries
CREATE INDEX idx_users_profile_data ON users USING GIN (profile_data);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_hierarchy_structures_updated_at(); -- Reuse the same function

-- Create function to validate hierarchy assignment
CREATE OR REPLACE FUNCTION validate_user_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure the assigned hierarchy exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM hierarchy_structures 
        WHERE id = NEW.base_hierarchy_id 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Cannot assign user to inactive or non-existent hierarchy node';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to validate hierarchy assignment
CREATE TRIGGER trigger_validate_user_hierarchy
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_user_hierarchy();

-- Create function to handle user soft delete
CREATE OR REPLACE FUNCTION soft_delete_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Instead of deleting, mark as inactive
    UPDATE users 
    SET is_active = false, 
        updated_at = CURRENT_TIMESTAMP,
        email = email || '_deleted_' || extract(epoch from now())::text
    WHERE id = OLD.id;
    
    -- Prevent the actual delete
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for soft delete (optional - can be enabled later)
-- CREATE TRIGGER trigger_users_soft_delete
--     BEFORE DELETE ON users
--     FOR EACH ROW
--     EXECUTE FUNCTION soft_delete_user();

-- Add foreign key references for audit fields (self-referencing)
ALTER TABLE users ADD CONSTRAINT fk_users_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_updated_by 
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Now add the foreign key references to hierarchy_structures
ALTER TABLE hierarchy_structures ADD CONSTRAINT fk_hierarchy_structures_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE hierarchy_structures ADD CONSTRAINT fk_hierarchy_structures_updated_by 
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts with base hierarchy location reference';
COMMENT ON COLUMN users.base_hierarchy_id IS 'Reference to user''s base location in hierarchy (lowest level)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password - never store plain text';
COMMENT ON COLUMN users.is_system_user IS 'Flag for system/service accounts';
COMMENT ON COLUMN users.failed_login_attempts IS 'Track failed login attempts for security';
COMMENT ON COLUMN users.locked_until IS 'Account lock timestamp for security';
COMMENT ON COLUMN users.profile_data IS 'Additional profile information stored as JSONB';