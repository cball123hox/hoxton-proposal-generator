-- ============================================================
-- 005: Categories table, expanded audit actions, schema updates
-- ============================================================

-- 1. Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Seed from existing category values
INSERT INTO public.categories (name, sort_order) VALUES
  ('Retirement', 1),
  ('Investment', 2),
  ('Tax Planning', 3),
  ('Estate Planning', 4),
  ('Insurance', 5),
  ('Services', 6);

-- 3. Add category_id FK to product_modules
ALTER TABLE public.product_modules
  ADD COLUMN category_id UUID REFERENCES public.categories(id);

-- Populate category_id from existing category text
UPDATE public.product_modules pm
SET category_id = c.id
FROM public.categories c
WHERE pm.category = c.name;

-- Make NOT NULL after population
ALTER TABLE public.product_modules
  ALTER COLUMN category_id SET NOT NULL;

-- 4. Drop the old CHECK constraint on category (allow dynamic categories)
ALTER TABLE public.product_modules
  DROP CONSTRAINT product_modules_category_check;

-- 5. Expand template_audit_log action CHECK for new actions
ALTER TABLE public.template_audit_log
  DROP CONSTRAINT template_audit_log_action_check;

ALTER TABLE public.template_audit_log
  ADD CONSTRAINT template_audit_log_action_check
  CHECK (action IN (
    'slide_added', 'slide_removed', 'slide_reordered', 'slide_replaced',
    'slide_bulk_uploaded', 'slide_deleted',
    'module_created', 'module_updated', 'module_disabled',
    'region_created', 'region_updated',
    'category_created', 'category_updated', 'category_deleted',
    'intro_pack_created'
  ));

-- 6. RLS for categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read categories"
  ON public.categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL TO authenticated USING (
    public.is_admin(auth.uid())
  );
