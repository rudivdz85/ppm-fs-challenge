-- Migration 002: Create users table
-- Description: Creates the users table with foreign key to hierarchy_structures
-- Dependencies: hierarchy_structures table from migration 001

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    base_hierarchy_id UUID NOT NULL REFERENCES hierarchy_structures(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT users_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_email_not_empty CHECK (LENGTH(TRIM(email)) > 0),
    CONSTRAINT users_full_name_not_empty CHECK (LENGTH(TRIM(full_name)) > 0),
    CONSTRAINT users_password_hash_not_empty CHECK (LENGTH(TRIM(password_hash)) > 0),
    CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~ '^\+?[1-9]\d{1,14}$')
);

-- Create indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_base_hierarchy_id ON users (base_hierarchy_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users (full_name);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users (last_login_at);

-- Create composite index for active users by hierarchy
CREATE INDEX IF NOT EXISTS idx_users_active_hierarchy ON users (base_hierarchy_id, is_active) WHERE is_active = true;

-- Create updated_at trigger function for users
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Create function to update last_login_at
CREATE OR REPLACE FUNCTION update_user_last_login(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET last_login_at = CURRENT_TIMESTAMP 
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts with hierarchical structure associations';
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.email IS 'Unique email address used for authentication';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (never store plaintext)';
COMMENT ON COLUMN users.full_name IS 'User''s full display name';
COMMENT ON COLUMN users.phone IS 'Optional phone number in international format';
COMMENT ON COLUMN users.base_hierarchy_id IS 'Primary hierarchy structure this user belongs to';
COMMENT ON COLUMN users.is_active IS 'Whether this user account is currently active';
COMMENT ON COLUMN users.metadata IS 'Additional JSON metadata for the user (preferences, etc.)';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of user''s last successful login';
COMMENT ON COLUMN users.created_at IS 'Timestamp when the user was created';
COMMENT ON COLUMN users.updated_at IS 'Timestamp when the user was last updated';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 002 completed: users table created successfully';
END $$;