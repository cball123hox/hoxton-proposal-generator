-- ============================================================================
-- FIX: RLS recursion on profiles table
--
-- The "Admins can manage all profiles" policy does a subquery on
-- public.profiles to check role = 'system_admin', which triggers RLS
-- evaluation on the same table → infinite recursion → 500 error.
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to
-- check admin status, then update ALL policies that had this pattern.
-- ============================================================================

-- 1. Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'system_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Fix profiles table policy
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Fix proposals table policies
DROP POLICY IF EXISTS "Planners can read own proposals" ON public.proposals;
CREATE POLICY "Planners can read own proposals" ON public.proposals
  FOR SELECT TO authenticated
  USING (
    advisor_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('planner_admin', 'power_planner')
        AND auth.uid() = ANY(assigned_advisors)
    )
  );

DROP POLICY IF EXISTS "Users can update own proposals" ON public.proposals;
CREATE POLICY "Users can update own proposals" ON public.proposals
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- 4. Fix template_audit_log policy
DROP POLICY IF EXISTS "Admins can write audit log" ON public.template_audit_log;
CREATE POLICY "Admins can write audit log" ON public.template_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Fix regions policy
DROP POLICY IF EXISTS "Admins can manage regions" ON public.regions;
CREATE POLICY "Admins can manage regions" ON public.regions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6. Fix intro_packs policy
DROP POLICY IF EXISTS "Admins can manage intro_packs" ON public.intro_packs;
CREATE POLICY "Admins can manage intro_packs" ON public.intro_packs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. Fix intro_slides policy
DROP POLICY IF EXISTS "Admins can manage intro_slides" ON public.intro_slides;
CREATE POLICY "Admins can manage intro_slides" ON public.intro_slides
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 8. Fix product_modules policy
DROP POLICY IF EXISTS "Admins can manage product_modules" ON public.product_modules;
CREATE POLICY "Admins can manage product_modules" ON public.product_modules
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 9. Fix product_slides policy
DROP POLICY IF EXISTS "Admins can manage product_slides" ON public.product_slides;
CREATE POLICY "Admins can manage product_slides" ON public.product_slides
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- NOTE: The "Planners can read own proposals" policy still has a subquery
-- on profiles for planner_admin/power_planner check. This is safe because
-- that query hits profiles SELECT policies which include the open
-- "Users can read all profiles" policy (no recursion risk on proposals table).
