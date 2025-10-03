-- Migration 001: Create hierarchy_structures table
-- Description: Creates the main hierarchy table using ltree for hierarchical paths
-- Dependencies: uuid-ossp extension for UUID generation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- Create hierarchy_structures table
CREATE TABLE IF NOT EXISTS hierarchy_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    path LTREE NOT NULL, -- Hierarchical path using ltree (e.g., 'national.city1.suburb1a')
    parent_id UUID REFERENCES hierarchy_structures(id) ON DELETE RESTRICT,
    depth INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT hierarchy_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT hierarchy_path_not_empty CHECK (nlevel(path) > 0),
    CONSTRAINT hierarchy_depth_consistent CHECK (depth = nlevel(path) - 1),
    CONSTRAINT hierarchy_root_has_no_parent CHECK (
        (parent_id IS NULL AND depth = 0) OR 
        (parent_id IS NOT NULL AND depth > 0)
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hierarchy_path ON hierarchy_structures USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_hierarchy_parent_id ON hierarchy_structures (parent_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_is_active ON hierarchy_structures (is_active);
CREATE INDEX IF NOT EXISTS idx_hierarchy_depth ON hierarchy_structures (depth);
CREATE INDEX IF NOT EXISTS idx_hierarchy_created_at ON hierarchy_structures (created_at);

-- Create unique index on path for fast lookups and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_hierarchy_path_unique ON hierarchy_structures (path);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_hierarchy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_hierarchy_updated_at ON hierarchy_structures;
CREATE TRIGGER trigger_hierarchy_updated_at
    BEFORE UPDATE ON hierarchy_structures
    FOR EACH ROW
    EXECUTE FUNCTION update_hierarchy_updated_at();

-- Add comments for documentation
COMMENT ON TABLE hierarchy_structures IS 'Hierarchical organizational structures using ltree for efficient path queries';
COMMENT ON COLUMN hierarchy_structures.id IS 'Unique identifier for the hierarchy structure';
COMMENT ON COLUMN hierarchy_structures.name IS 'Human-readable name of the structure (e.g., "Engineering Department")';
COMMENT ON COLUMN hierarchy_structures.description IS 'Optional detailed description of the structure';
COMMENT ON COLUMN hierarchy_structures.path IS 'Hierarchical path using ltree (e.g., "company.engineering.backend")';
COMMENT ON COLUMN hierarchy_structures.parent_id IS 'Reference to parent structure, NULL for root structures';
COMMENT ON COLUMN hierarchy_structures.depth IS 'Depth level in hierarchy (0 for root, 1 for children, etc.)';
COMMENT ON COLUMN hierarchy_structures.is_active IS 'Whether this structure is currently active';
COMMENT ON COLUMN hierarchy_structures.metadata IS 'Additional JSON metadata for the structure';
COMMENT ON COLUMN hierarchy_structures.created_at IS 'Timestamp when the structure was created';
COMMENT ON COLUMN hierarchy_structures.updated_at IS 'Timestamp when the structure was last updated';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 001 completed: hierarchy_structures table created successfully';
END $$;