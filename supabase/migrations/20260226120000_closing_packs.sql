-- Closing Packs: region-specific closing slides (mirrors intro_packs pattern)

-- ── closing_packs table ──
CREATE TABLE IF NOT EXISTS closing_packs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id  TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── closing_slides table ──
CREATE TABLE IF NOT EXISTS closing_slides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_pack_id UUID NOT NULL REFERENCES closing_packs(id) ON DELETE CASCADE,
  slide_number    INTEGER NOT NULL,
  title           TEXT NOT NULL DEFAULT '',
  slide_type      TEXT NOT NULL DEFAULT 'static',
  image_path      TEXT,
  editable_fields JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closing_slides_pack_number
  ON closing_slides(closing_pack_id, slide_number);

-- ── Add closing_slides_count to regions ──
ALTER TABLE regions
  ADD COLUMN IF NOT EXISTS closing_slides_count INTEGER NOT NULL DEFAULT 0;

-- ── RLS ──
ALTER TABLE closing_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_slides ENABLE ROW LEVEL SECURITY;

-- closing_packs policies
CREATE POLICY "Authenticated users can read closing_packs"
  ON closing_packs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System admins can manage closing_packs"
  ON closing_packs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'system_admin'
    )
  );

-- closing_slides policies
CREATE POLICY "Authenticated users can read closing_slides"
  ON closing_slides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System admins can manage closing_slides"
  ON closing_slides FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'system_admin'
    )
  );

-- ── Seed: create closing packs for existing regions ──
INSERT INTO closing_packs (region_id, name)
SELECT id, display_name || ' Closing Pack'
FROM regions
WHERE id IN ('uk', 'asia', 'int', 'jp')
ON CONFLICT DO NOTHING;
