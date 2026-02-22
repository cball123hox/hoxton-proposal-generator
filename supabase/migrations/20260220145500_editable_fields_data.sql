-- Migration 006: Add editable_fields_data to proposals table
-- Stores user-filled editable field values per slide for PDF generation

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS editable_fields_data jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN proposals.editable_fields_data IS 'JSONB map of slideId -> { fieldName: value } for editable text overlays on slides';

-- Expand the audit action CHECK to include editable field actions
ALTER TABLE template_audit_log
DROP CONSTRAINT IF EXISTS template_audit_log_action_check;

ALTER TABLE template_audit_log
ADD CONSTRAINT template_audit_log_action_check
CHECK (action IN (
  'slide_added', 'slide_removed', 'slide_reordered', 'slide_replaced',
  'slide_bulk_uploaded', 'slide_deleted',
  'module_created', 'module_updated', 'module_disabled',
  'region_created', 'region_updated',
  'category_created', 'category_updated', 'category_deleted',
  'intro_pack_created',
  'editable_fields_updated'
));
