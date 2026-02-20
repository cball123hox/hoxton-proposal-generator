import { ChevronRight, Layers } from 'lucide-react'
import type { ReactNode } from 'react'

interface CategorySectionProps {
  categoryName: string
  moduleCount: number
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
}

export function CategorySection({
  categoryName,
  moduleCount,
  isExpanded,
  onToggle,
  children,
}: CategorySectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="mb-3 flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-hoxton-light/50"
      >
        <ChevronRight
          className={`h-4 w-4 text-hoxton-slate transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        <Layers className="h-4 w-4 text-hoxton-slate" />
        <h3 className="text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
          {categoryName}
        </h3>
        <span className="text-xs font-body text-gray-400">
          ({moduleCount})
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}
