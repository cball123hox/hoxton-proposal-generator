ALTER TABLE proposals ADD COLUMN IF NOT EXISTS disabled_slides jsonb DEFAULT '[]'::jsonb;
