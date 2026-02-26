export type UserRole = 'system_admin' | 'planner' | 'planner_admin' | 'power_planner'

export type ProposalStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent'

export type ProductLayout = 'new' | 'old'

export type Category = 'Retirement' | 'Investment' | 'Tax Planning' | 'Estate Planning' | 'Insurance' | 'Services'

export interface Region {
  id: string
  name: string
  display: string
  introSlides: number
}

export interface ProductModule {
  id: string
  name: string
  category: Category
  regions: string[]
  slides: number
  layout: ProductLayout
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  region?: string
  assigned_advisors?: string[]
  avatar_url?: string
  is_active?: boolean
  created_at: string
  updated_at: string
}

export interface ProposalDraft {
  hxtNumber: string
  clientName: string
  clientEmail: string
  advisorId: string | null
  regionId: string
  transcript: string
  aiParsedContext: { situation: string; objectives: string; focus: string } | null
  context: { situation: string; objectives: string; focus: string }
  selectedProducts: string[]
  disabledSlides: string[]
  editableFieldsData: EditableFieldsData
}

// ── Editable slide field types ──

export interface EditableFieldDef {
  id: string
  name: string
  label: string
  type: 'text' | 'textarea' | 'table'
  x: number       // percentage 0-100
  y: number       // percentage 0-100
  width: number   // percentage 0-100
  height: number  // percentage 0-100
  fontSize: number // px at 1280x720
  fontFamily: 'heading' | 'body'
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold'
  color: string   // hex color
  textAlign: 'left' | 'center' | 'right'
  autoFill?: string  // e.g. 'client_name', 'advisor_name', 'date', 'hxt_reference'
}

/** Map of slideId -> { fieldName: value } */
export type EditableFieldsData = Record<string, Record<string, string>>

export interface ProposalContext {
  situation: string
  objectives: string
  focus: string
}

// ── DB-shaped types (matching Supabase table columns) ──

export interface DbRegion {
  id: string
  name: string
  display_name: string
  intro_slides_count: number
  closing_slides_count: number
  is_active: boolean
  sort_order: number
}

export interface DbIntroPack {
  id: string
  region_id: string
  name: string
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbIntroSlide {
  id: string
  intro_pack_id: string
  slide_number: number
  title: string
  slide_type: 'static' | 'editable' | 'product_insert' | 'divider'
  image_path: string | null
  editable_fields: EditableFieldDef[]
  created_at: string
}

export interface DbClosingPack {
  id: string
  region_id: string
  name: string
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbClosingSlide {
  id: string
  closing_pack_id: string
  slide_number: number
  title: string
  slide_type: 'static' | 'editable'
  image_path: string | null
  editable_fields: EditableFieldDef[]
  created_at: string
}

export interface DbProductModule {
  id: string
  name: string
  category: string
  category_id: string
  regions: string[]
  slides_count: number
  layout: ProductLayout
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DbProductSlide {
  id: string
  module_id: string
  slide_number: number
  title: string
  slide_type: 'static' | 'editable' | 'fee_structure'
  image_path: string | null
  editable_fields: EditableFieldDef[]
  created_at: string
}

export interface DbCategory {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AuditAction =
  | 'slide_added' | 'slide_removed' | 'slide_reordered' | 'slide_replaced'
  | 'slide_bulk_uploaded' | 'slide_deleted'
  | 'module_created' | 'module_updated' | 'module_disabled'
  | 'region_created' | 'region_updated'
  | 'category_created' | 'category_updated' | 'category_deleted'
  | 'intro_pack_created'
  | 'closing_pack_created'
  | 'editable_fields_updated'

export interface Proposal {
  id: string
  advisor_id: string
  created_by: string
  client_name: string
  client_email?: string
  hxt_reference?: string
  region_id: string
  intro_pack_id?: string
  selected_products: string[]
  summary_context: ProposalContext
  fee_data: Record<string, unknown>
  status: ProposalStatus
  transcript_text?: string
  ai_parsed_context?: Record<string, unknown>
  pdf_path?: string
  editable_fields_data?: Record<string, Record<string, string>>
  pdf_generated_at?: string
  viewer_token?: string
  sent_at?: string
  approval_notes?: string
  approved_by?: string
  created_at: string
  updated_at: string
}
