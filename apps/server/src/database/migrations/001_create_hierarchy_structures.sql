-- Migration: 001_create_hierarchy_structures.sql
-- Description: Create hierarchical structure table using materialized path pattern
-- Author: PPM FS Challenge
-- Created: 2025-09-29

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- Create hierarchy_structures table using materialized path pattern
CREATE TABLE hierarchy_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- Unique identifier for programmatic access
    description TEXT,
    
    -- Materialized path using ltree for efficient hierarchical queries
    path LTREE NOT NULL,
    
    -- Parent reference for easier joins (denormalized for performance)
    parent_id UUID REFERENCES hierarchy_structures(id) ON DELETE CASCADE,
    
    -- Hierarchy metadata
    level INTEGER NOT NULL DEFAULT 0, -- 0 = root, 1 = first level, etc.
    sort_order INTEGER DEFAULT 0, -- For custom ordering within same level
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- Will reference users table after it's created
    updated_by UUID, -- Will reference users table after it's created
    
    -- Additional metadata as JSON for flexibility
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT hierarchy_structures_level_check CHECK (level >= 0),
    CONSTRAINT hierarchy_structures_path_not_empty CHECK (path::text != ''),
    CONSTRAINT hierarchy_structures_code_format CHECK (code ~ '^[a-z0-9_]+$')
);

-- Create indexes for performance
CREATE UNIQUE INDEX idx_hierarchy_structures_path ON hierarchy_structures (path);
CREATE INDEX idx_hierarchy_structures_path_gist ON hierarchy_structures USING GIST (path);
CREATE INDEX idx_hierarchy_structures_parent_id ON hierarchy_structures(parent_id);
CREATE INDEX idx_hierarchy_structures_level ON hierarchy_structures(level);
CREATE INDEX idx_hierarchy_structures_code ON hierarchy_structures(code);
CREATE INDEX idx_hierarchy_structures_active ON hierarchy_structures(is_active);
CREATE INDEX idx_hierarchy_structures_sort_order ON hierarchy_structures(sort_order);
CREATE INDEX idx_hierarchy_structures_created_at ON hierarchy_structures(created_at);

-- Create partial index for active records only (most common queries)
CREATE INDEX idx_hierarchy_structures_active_path ON hierarchy_structures USING GIST (path) WHERE is_active = true;

-- Create GIN index for metadata JSONB queries
CREATE INDEX idx_hierarchy_structures_metadata ON hierarchy_structures USING GIN (metadata);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hierarchy_structures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_hierarchy_structures_updated_at
    BEFORE UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION update_hierarchy_structures_updated_at();

-- Create function to validate hierarchy path consistency
CREATE OR REPLACE FUNCTION validate_hierarchy_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path LTREE;
    expected_level INTEGER;
BEGIN
    -- If this is a root node (no parent)
    IF NEW.parent_id IS NULL THEN
        -- Root node should have level 0 and path should be just the code
        IF NEW.level != 0 THEN
            RAISE EXCEPTION 'Root node must have level 0, got level %', NEW.level;
        END IF;
        
        NEW.path = NEW.code::LTREE;
        RETURN NEW;
    END IF;
    
    -- Get parent's path and level
    SELECT path, level INTO parent_path, expected_level
    FROM hierarchy_structures
    WHERE id = NEW.parent_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent node with id % not found', NEW.parent_id;
    END IF;
    
    -- Validate level is parent level + 1
    IF NEW.level != expected_level + 1 THEN
        RAISE EXCEPTION 'Level must be parent level + 1. Expected %, got %', expected_level + 1, NEW.level;
    END IF;
    
    -- Build path as parent_path.code
    NEW.path = parent_path || NEW.code::LTREE;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to validate and auto-generate path
CREATE TRIGGER trigger_validate_hierarchy_path
    BEFORE INSERT OR UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION validate_hierarchy_path();

-- Create function to prevent cycles in hierarchy
CREATE OR REPLACE FUNCTION prevent_hierarchy_cycles()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the new parent would create a cycle
    IF NEW.parent_id IS NOT NULL THEN
        -- Check if the new parent is a descendant of the current node
        IF EXISTS (
            SELECT 1 FROM hierarchy_structures
            WHERE id = NEW.parent_id
            AND path <@ (SELECT path FROM hierarchy_structures WHERE id = NEW.id)
        ) THEN
            RAISE EXCEPTION 'Cannot set parent: would create a cycle in hierarchy';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to prevent cycles
CREATE TRIGGER trigger_prevent_hierarchy_cycles
    BEFORE UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION prevent_hierarchy_cycles();

-- Create function to update all descendant paths when a node's path changes
CREATE OR REPLACE FUNCTION update_descendant_paths()
RETURNS TRIGGER AS $$
DECLARE
    old_path_text TEXT;
    new_path_text TEXT;
BEGIN
    -- Only process if path actually changed
    IF OLD.path != NEW.path THEN
        old_path_text = OLD.path::TEXT;
        new_path_text = NEW.path::TEXT;
        
        -- Update all descendants
        UPDATE hierarchy_structures
        SET path = (new_path_text || subpath(path::TEXT, nlevel(OLD.path)))::LTREE
        WHERE path <@ OLD.path
        AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update descendant paths
CREATE TRIGGER trigger_update_descendant_paths
    AFTER UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION update_descendant_paths();

-- Add comments for documentation
COMMENT ON TABLE hierarchy_structures IS 'Hierarchical structure table using materialized path pattern with ltree';
COMMENT ON COLUMN hierarchy_structures.path IS 'Materialized path using ltree for efficient hierarchical queries';
COMMENT ON COLUMN hierarchy_structures.code IS 'Unique identifier for programmatic access (lowercase, alphanumeric, underscores)';
COMMENT ON COLUMN hierarchy_structures.level IS 'Hierarchy level: 0=root, 1=first level, etc.';
COMMENT ON COLUMN hierarchy_structures.sort_order IS 'Custom ordering within the same hierarchy level';
COMMENT ON COLUMN hierarchy_structures.metadata IS 'Additional metadata stored as JSONB for flexibility';