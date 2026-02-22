import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Save, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { ProposalProgress } from '../components/proposal/ProposalProgress'
import { StepClientDetails } from '../components/proposal/StepClientDetails'
import { StepRegionSelect } from '../components/proposal/StepRegionSelect'
import { StepTranscript } from '../components/proposal/StepTranscript'
import { StepSummaryContext } from '../components/proposal/StepSummaryContext'
import { StepProductSelect } from '../components/proposal/StepProductSelect'
import { StepCustomiseSlides } from '../components/proposal/StepCustomiseSlides'
import { StepPreviewGenerate } from '../components/proposal/StepPreviewGenerate'
import type { ProposalDraft } from '../types'

const INITIAL_DRAFT: ProposalDraft = {
  hxtNumber: '',
  clientName: '',
  clientEmail: '',
  advisorId: null,
  regionId: '',
  transcript: '',
  aiParsedContext: null,
  context: { situation: '', objectives: '', focus: '' },
  selectedProducts: [],
  disabledSlides: [],
  editableFieldsData: {},
}

export function NewProposalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [maxStepReached, setMaxStepReached] = useState(1)
  const [draft, setDraft] = useState<ProposalDraft>(INITIAL_DRAFT)
  const [saving, setSaving] = useState(false)
  const [proposalId, setProposalId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)

  // Load existing proposal when ?edit={id} is present
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId) return

    async function loadProposal(id: string) {
      setLoadingEdit(true)
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        setDraft({
          hxtNumber: data.hxt_reference || '',
          clientName: data.client_name || '',
          clientEmail: data.client_email || '',
          advisorId: data.advisor_id || null,
          regionId: data.region_id || '',
          transcript: data.transcript_text || '',
          aiParsedContext: data.ai_parsed_context as ProposalDraft['aiParsedContext'] ?? null,
          context: data.summary_context || { situation: '', objectives: '', focus: '' },
          selectedProducts: data.selected_products || [],
          disabledSlides: data.disabled_slides || [],
          editableFieldsData: data.editable_fields_data || {},
        })
        setProposalId(data.id)
        setStep(2)
        setMaxStepReached(2)
        setIsEditMode(true)
      }
      setLoadingEdit(false)
    }

    loadProposal(editId)
  }, [searchParams])

  const updateDraft = useCallback(
    (updates: Partial<ProposalDraft>) =>
      setDraft((prev) => ({ ...prev, ...updates })),
    []
  )

  // Cmd/Ctrl+S to save draft
  const canSaveDraft = !!draft.clientName.trim() && !!draft.regionId
  useKeyboardShortcut('s', () => { if (canSaveDraft && !saving) saveDraft() }, { ctrl: true, enabled: canSaveDraft })

  const isStepValid = (): boolean => {
    switch (step) {
      case 1:
        return draft.clientName.trim().length > 0 && draft.clientEmail.trim().length > 0
      case 2:
        return draft.regionId !== ''
      case 3:
        return true
      case 4:
        return true
      case 5:
        return draft.selectedProducts.length > 0
      case 6:
        return true
      case 7:
        return true
      default:
        return false
    }
  }

  async function saveDraft(): Promise<string | null> {
    if (!user) return null
    setSaving(true)

    const payload = {
      advisor_id: draft.advisorId ?? user.id,
      created_by: user.id,
      client_name: draft.clientName,
      client_email: draft.clientEmail || null,
      hxt_reference: draft.hxtNumber || null,
      region_id: draft.regionId || 'int',
      selected_products: draft.selectedProducts,
      summary_context: draft.context,
      transcript_text: draft.transcript || null,
      ai_parsed_context: draft.aiParsedContext,
      editable_fields_data: draft.editableFieldsData,
      disabled_slides: draft.disabledSlides,
      status: 'draft' as const,
    }

    let id = proposalId

    if (id) {
      await supabase.from('proposals').update(payload).eq('id', id)
    } else {
      const { data } = await supabase
        .from('proposals')
        .insert(payload)
        .select('id')
        .single()
      if (data) {
        id = data.id
        setProposalId(id)
      }
    }

    setSaving(false)
    return id
  }

  function goNext() {
    if (step < 7 && isStepValid()) {
      const next = step + 1
      setStep(next)
      setMaxStepReached((prev) => Math.max(prev, next))
    }
  }

  function goBack() {
    if (step > 1) setStep(step - 1)
  }

  if (loadingEdit) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-hoxton-turquoise" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col pb-20">
      <ProposalProgress
        currentStep={step}
        maxStepReached={maxStepReached}
        lockedStep={isEditMode ? 1 : undefined}
        onStepClick={(s) => setStep(s)}
      />

      <div className="flex-1">
        {step === 1 && (
          <StepClientDetails draft={draft} updateDraft={updateDraft} locked={isEditMode} />
        )}
        {step === 2 && (
          <StepRegionSelect
            draft={draft}
            updateDraft={updateDraft}
            onAutoAdvance={goNext}
          />
        )}
        {step === 3 && (
          <StepTranscript
            draft={draft}
            updateDraft={updateDraft}
            onSkip={goNext}
          />
        )}
        {step === 4 && (
          <StepSummaryContext draft={draft} updateDraft={updateDraft} />
        )}
        {step === 5 && (
          <StepProductSelect draft={draft} updateDraft={updateDraft} />
        )}
        {step === 6 && (
          <StepCustomiseSlides draft={draft} updateDraft={updateDraft} />
        )}
        {step === 7 && (
          <StepPreviewGenerate draft={draft} onSaveDraft={saveDraft} proposalId={proposalId} updateDraft={updateDraft} />
        )}
      </div>

      {/* Bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 bg-white px-8 py-4 lg:left-64">
        <div className="flex items-center justify-between">
          <div>
            {isEditMode && step <= 2 ? null : step > 1 ? (
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate transition-colors hover:bg-hoxton-light hover:text-hoxton-deep"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate transition-colors hover:bg-hoxton-light hover:text-hoxton-deep"
              >
                <ChevronLeft className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {draft.clientName.trim() && draft.regionId && (
              <button
                onClick={() => saveDraft()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-hoxton-grey bg-white px-4 py-2.5 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </button>
            )}

            {step < 7 && (
              <button
                onClick={goNext}
                disabled={!isStepValid()}
                className="inline-flex items-center gap-1 rounded-lg bg-hoxton-turquoise px-5 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
