import { Check, Lock } from 'lucide-react'

const STEPS = [
  { number: 1, label: 'Client Details' },
  { number: 2, label: 'Region' },
  { number: 3, label: 'Transcript' },
  { number: 4, label: 'Summary' },
  { number: 5, label: 'Discussion Areas' },
  { number: 6, label: 'Customise' },
  { number: 7, label: 'Preview' },
]

interface ProposalProgressProps {
  currentStep: number
  maxStepReached?: number
  lockedStep?: number
  onStepClick?: (stepNumber: number) => void
}

export function ProposalProgress({ currentStep, maxStepReached, lockedStep, onStepClick }: ProposalProgressProps) {
  const highWater = maxStepReached ?? currentStep

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isVisited = highWater >= step.number
          const isComplete = currentStep > step.number
          const isCurrent = currentStep === step.number
          const isFuture = currentStep < step.number
          const isLocked = lockedStep === step.number && (isComplete || isVisited)
          const isClickable = isVisited && !isCurrent && !isLocked && !!onStepClick

          function handleClick() {
            if (isClickable) onStepClick!(step.number)
          }

          return (
            <div key={step.number} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={handleClick}
                disabled={!isClickable}
                className={`flex flex-col items-center ${
                  isClickable ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-default'
                } group`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-heading font-semibold transition-all ${
                    isCurrent
                      ? 'bg-hoxton-turquoise text-white shadow-md shadow-hoxton-turquoise/30'
                      : isVisited
                        ? isLocked
                          ? 'bg-hoxton-turquoise/70 text-white'
                          : 'bg-hoxton-turquoise text-white'
                        : 'bg-gray-100 text-gray-400'
                  } ${isClickable ? 'group-hover:scale-110 group-hover:shadow-md group-hover:shadow-hoxton-turquoise/20' : ''}`}
                >
                  {isLocked ? (
                    <Lock className="h-4 w-4" />
                  ) : isVisited && !isCurrent ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-heading font-medium whitespace-nowrap transition-all ${
                    isCurrent
                      ? 'text-hoxton-turquoise'
                      : isVisited
                        ? 'text-hoxton-deep'
                        : 'text-gray-400'
                  } ${isClickable ? 'group-hover:text-hoxton-turquoise' : ''}`}
                >
                  {step.label}
                </span>
              </button>

              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 mb-6 h-0.5 flex-1 rounded-full transition-colors ${
                    !isVisited ? 'bg-gray-100' : 'bg-hoxton-turquoise'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
