import type { ProposalDraft } from '../../types'

interface StepSummaryContextProps {
  draft: ProposalDraft
  updateDraft: (updates: Partial<ProposalDraft>) => void
}

const FIELDS: { key: 'situation' | 'objectives' | 'focus'; label: string; placeholder: string }[] = [
  {
    key: 'situation',
    label: 'Current Situation',
    placeholder: 'Describe the client\'s current financial situation, assets, and circumstances...',
  },
  {
    key: 'objectives',
    label: 'Main Objectives',
    placeholder: 'What are the client\'s primary financial goals and objectives...',
  },
  {
    key: 'focus',
    label: 'Focus Areas',
    placeholder: 'Key areas of focus and recommended strategies...',
  },
]

export function StepSummaryContext({ draft, updateDraft }: StepSummaryContextProps) {
  const isAiFilled = draft.aiParsedContext !== null

  function handleChange(key: 'situation' | 'objectives' | 'focus', value: string) {
    updateDraft({
      context: { ...draft.context, [key]: value },
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
        Summary of Context
      </h2>
      <p className="mt-1 mb-6 text-sm font-body text-hoxton-slate">
        Review and refine the key context that will appear in the proposal
      </p>

      <div className="space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                {field.label}
              </label>
              {isAiFilled && draft.context[field.key] && (
                <span className="text-xs font-heading font-medium text-hoxton-turquoise">
                  (Pre-filled by AI — review and edit)
                </span>
              )}
            </div>
            <textarea
              value={draft.context[field.key]}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className="w-full resize-none rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-3 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
