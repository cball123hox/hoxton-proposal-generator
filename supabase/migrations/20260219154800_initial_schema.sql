-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES (extends auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'planner' CHECK (role IN ('system_admin', 'planner', 'planner_admin', 'power_planner')),
  region TEXT DEFAULT 'int' CHECK (region IN ('uk', 'asia', 'int', 'jp')),
  assigned_advisors UUID[] DEFAULT '{}',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- REGIONS
-- ============================================================================
CREATE TABLE public.regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  intro_slides_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- ============================================================================
-- INTRO PACKS
-- ============================================================================
CREATE TABLE public.intro_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id TEXT NOT NULL REFERENCES public.regions(id),
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INTRO SLIDES
-- ============================================================================
CREATE TABLE public.intro_slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intro_pack_id UUID NOT NULL REFERENCES public.intro_packs(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  slide_type TEXT DEFAULT 'static' CHECK (slide_type IN ('static', 'editable', 'product_insert', 'divider')),
  image_path TEXT,
  editable_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PRODUCT MODULES
-- ============================================================================
CREATE TABLE public.product_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Retirement', 'Investment', 'Tax Planning', 'Estate Planning', 'Insurance', 'Services')),
  regions TEXT[] NOT NULL DEFAULT '{}',
  slides_count INTEGER DEFAULT 0,
  layout TEXT DEFAULT 'new' CHECK (layout IN ('new', 'old')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PRODUCT SLIDES
-- ============================================================================
CREATE TABLE public.product_slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id TEXT NOT NULL REFERENCES public.product_modules(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  slide_type TEXT DEFAULT 'static' CHECK (slide_type IN ('static', 'editable', 'fee_structure')),
  image_path TEXT,
  editable_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PROPOSALS
-- ============================================================================
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id UUID NOT NULL REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  client_name TEXT NOT NULL,
  client_email TEXT,
  region_id TEXT NOT NULL REFERENCES public.regions(id),
  intro_pack_id UUID REFERENCES public.intro_packs(id),
  selected_products TEXT[] DEFAULT '{}',
  summary_context JSONB DEFAULT '{"situation": "", "objectives": "", "focus": ""}',
  fee_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'sent')),
  transcript_text TEXT,
  ai_parsed_context JSONB,
  pdf_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  viewer_token TEXT UNIQUE,
  sent_at TIMESTAMPTZ,
  approval_notes TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PROPOSAL EVENTS (analytics tracking)
-- ============================================================================
CREATE TABLE public.proposal_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'edited', 'ai_parsed', 'products_selected', 'pdf_generated', 'sent', 'opened', 'slide_viewed', 'approved', 'rejected')),
  event_data JSONB DEFAULT '{}',
  actor_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TEMPLATE AUDIT LOG
-- ============================================================================
CREATE TABLE public.template_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL CHECK (action IN ('slide_added', 'slide_removed', 'slide_reordered', 'slide_replaced', 'module_created', 'module_updated', 'module_disabled')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB DEFAULT '{}',
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_proposals_advisor ON public.proposals(advisor_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposals_created_at ON public.proposals(created_at DESC);
CREATE INDEX idx_proposals_viewer_token ON public.proposals(viewer_token);
CREATE INDEX idx_proposal_events_proposal ON public.proposal_events(proposal_id);
CREATE INDEX idx_proposal_events_type ON public.proposal_events(event_type);
CREATE INDEX idx_intro_slides_pack ON public.intro_slides(intro_pack_id, slide_number);
CREATE INDEX idx_product_slides_module ON public.product_slides(module_id, slide_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_audit_log ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read template data
CREATE POLICY "Authenticated users can read regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read intro_packs" ON public.intro_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read intro_slides" ON public.intro_slides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read product_modules" ON public.product_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read product_slides" ON public.product_slides FOR SELECT TO authenticated USING (true);

-- Profiles: users can read all, update own
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);

-- Proposals: planners see own, planner_admins see assigned advisors, admins see all
CREATE POLICY "Planners can read own proposals" ON public.proposals FOR SELECT TO authenticated USING (
  advisor_id = auth.uid() OR created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin') OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('planner_admin', 'power_planner') AND auth.uid() = ANY(assigned_advisors))
);
CREATE POLICY "Authenticated users can create proposals" ON public.proposals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own proposals" ON public.proposals FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);

-- Proposal events: same as proposals
CREATE POLICY "Users can read proposal events" ON public.proposal_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create proposal events" ON public.proposal_events FOR INSERT TO authenticated WITH CHECK (true);

-- Template audit log: admins only write, all can read
CREATE POLICY "All can read audit log" ON public.template_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can write audit log" ON public.template_audit_log FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);

-- Admin write access to template tables
CREATE POLICY "Admins can manage regions" ON public.regions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);
CREATE POLICY "Admins can manage intro_packs" ON public.intro_packs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);
CREATE POLICY "Admins can manage intro_slides" ON public.intro_slides FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);
CREATE POLICY "Admins can manage product_modules" ON public.product_modules FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);
CREATE POLICY "Admins can manage product_slides" ON public.product_slides FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'system_admin')
);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Regions
INSERT INTO public.regions (id, name, display_name, intro_slides_count, sort_order) VALUES
  ('uk', 'UK', 'United Kingdom', 21, 1),
  ('asia', 'Asia', 'Asia Pacific', 21, 2),
  ('int', 'International', 'International', 22, 3),
  ('jp', 'Japan', 'Japan', 14, 4);

-- Product Modules
INSERT INTO public.product_modules (id, name, category, regions, slides_count, layout, sort_order) VALUES
  ('sipp-intl', 'UK Retirement Options (SIPP)', 'Retirement', '{uk,int,asia}', 12, 'new', 1),
  ('sipp-domestic', 'UK Retirement Options (Domestic)', 'Retirement', '{uk}', 8, 'new', 2),
  ('gia-intl', 'General Investment Account (GIA)', 'Investment', '{int,asia}', 11, 'new', 3),
  ('gia-domestic', 'GIA (UK Domestic)', 'Investment', '{uk}', 5, 'new', 4),
  ('offshore-bond', 'Offshore Bond', 'Tax Planning', '{uk,int}', 13, 'new', 5),
  ('offshore-bond-aus', 'Offshore Bond (Australia)', 'Tax Planning', '{asia}', 12, 'new', 6),
  ('401k', '401(k) / IRA Rollover', 'Retirement', '{int}', 10, 'new', 7),
  ('annuities', 'Annuities', 'Insurance', '{int}', 5, 'new', 8),
  ('fpcf', 'Focus Private Credit Fund', 'Investment', '{uk,int,asia,jp}', 9, 'new', 9),
  ('fic', 'Family Investment Company (FIC)', 'Tax Planning', '{uk}', 3, 'old', 10),
  ('vct', 'Venture Capital Trust (VCT)', 'Tax Planning', '{uk}', 6, 'old', 11),
  ('eis', 'Enterprise Investment Scheme (EIS)', 'Tax Planning', '{uk}', 4, 'old', 12),
  ('ssas', 'SSAS', 'Retirement', '{uk}', 3, 'old', 13),
  ('estate-planning', 'Estate Planning', 'Estate Planning', '{uk,int}', 6, 'old', 14),
  ('bushell', 'Bushell Investment Group', 'Investment', '{int}', 4, 'old', 15),
  ('tab-bond', 'TAB Bond', 'Investment', '{int}', 4, 'old', 16),
  ('focus-bond', 'Focus AF Property & Lotus Sanctuary', 'Investment', '{int}', 4, 'old', 17),
  ('structured-notes', 'Structured Notes', 'Investment', '{int}', 7, 'old', 18),
  ('assurance-vie', 'Assurance Vie', 'Tax Planning', '{int}', 6, 'old', 19),
  ('australian-bond', 'Australian Bond', 'Investment', '{asia}', 8, 'old', 20),
  ('us-estate-tax', 'US Estate Tax Planning', 'Estate Planning', '{int}', 6, 'old', 21),
  ('401k-active', '401(k)/403(b) Active Management', 'Retirement', '{int}', 3, 'old', 22),
  ('iul', 'IUL / 529 Alternative', 'Insurance', '{int}', 5, 'old', 23),
  ('accountancy', 'Hoxton Accountancy Services', 'Services', '{int}', 5, 'old', 24);
