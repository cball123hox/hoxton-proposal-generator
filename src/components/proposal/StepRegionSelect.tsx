import { useState } from 'react'
import { Check } from 'lucide-react'
import { REGIONS } from '../../lib/constants'
import type { ProposalDraft } from '../../types'

interface StepRegionSelectProps {
  draft: ProposalDraft
  updateDraft: (updates: Partial<ProposalDraft>) => void
  onAutoAdvance: () => void
}

/* ── Region Illustrations ── */

function FlagImage({
  src,
  alt,
  fallbackLabel,
}: {
  src: string
  alt: string
  fallbackLabel: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-hoxton-deep">
        <span className="text-lg font-heading font-bold text-white">{fallbackLabel}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-full w-full rounded-lg object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function UKIllustration() {
  return (
    <div className="h-[80px] w-[120px] overflow-hidden rounded-lg shadow-sm">
      <FlagImage
        src="https://flagcdn.com/w320/gb.png"
        alt="United Kingdom flag"
        fallbackLabel="UK"
      />
    </div>
  )
}

function JapanIllustration() {
  return (
    <div className="h-[80px] w-[120px] overflow-hidden rounded-lg shadow-sm">
      <FlagImage
        src="https://flagcdn.com/w320/jp.png"
        alt="Japan flag"
        fallbackLabel="JP"
      />
    </div>
  )
}

function AsiaIllustration() {
  return (
    <div className="h-[80px] w-[120px] overflow-hidden rounded-lg shadow-sm">
      <FlagImage
        src="https://flagcdn.com/w320/my.png"
        alt="Malaysia flag"
        fallbackLabel="Asia"
      />
    </div>
  )
}

function InternationalIllustration() {
  return (
    <div className="flex h-[80px] w-[120px] items-center justify-center rounded-lg shadow-sm">
      <span className="text-[80px] leading-none">🌍</span>
    </div>
  )
}

const REGION_ILLUSTRATION: Record<string, React.FC> = {
  uk: UKIllustration,
  asia: AsiaIllustration,
  int: InternationalIllustration,
  jp: JapanIllustration,
}

export function StepRegionSelect({ draft, updateDraft, onAutoAdvance }: StepRegionSelectProps) {
  function handleSelect(regionId: string) {
    updateDraft({ regionId, selectedProducts: [] })
    setTimeout(onAutoAdvance, 300)
  }

  return (
    <div>
      <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
        Select Region
      </h2>
      <p className="mt-1 mb-6 text-sm font-body text-hoxton-slate">
        Choose the region for this proposal — this determines the intro pack and available products
      </p>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {REGIONS.map((region) => {
          const isSelected = draft.regionId === region.id
          const Illustration = REGION_ILLUSTRATION[region.id] ?? InternationalIllustration

          return (
            <button
              key={region.id}
              onClick={() => handleSelect(region.id)}
              className={`group relative flex flex-col items-center rounded-2xl border-2 px-5 pb-5 pt-6 text-center transition-all ${
                isSelected
                  ? 'border-hoxton-turquoise bg-white shadow-lg shadow-hoxton-turquoise/10'
                  : 'border-hoxton-grey bg-white hover:border-hoxton-slate/40 hover:shadow-md'
              }`}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-hoxton-turquoise text-white">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}

              <div className="mb-4">
                <Illustration />
              </div>

              <h3 className="text-lg font-heading font-semibold text-hoxton-deep">
                {region.name}
              </h3>
              <p className="mt-0.5 text-sm font-body text-hoxton-slate">
                {region.display}
              </p>
              <p className="mt-2 text-xs font-heading font-medium text-gray-400">
                {region.introSlides} intro slides
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
