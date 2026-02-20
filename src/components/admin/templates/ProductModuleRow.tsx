import { SlideThumb } from './SlideThumb'
import { getSlideUrl } from '../../../lib/storage'
import type { DbProductModule, DbRegion } from '../../../types'

interface ProductModuleRowProps {
  module: DbProductModule
  regions: DbRegion[]
  onManage: () => void
}

export function ProductModuleRow({ module: mod, regions, onManage }: ProductModuleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4">
      <div className="flex items-center gap-4">
        {/* Mini thumbnail */}
        <div className="h-10 w-16 shrink-0 overflow-hidden rounded border border-gray-100 bg-gray-50">
          <SlideThumb
            src={getSlideUrl(`products/${mod.id}/Slide1.PNG`)}
            alt={mod.name}
            className="h-full w-full"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-heading font-medium text-hoxton-deep">
              {mod.name}
            </h4>
            {mod.layout === 'old' && (
              <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-heading font-semibold uppercase text-amber-700">
                Legacy
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs font-body text-gray-400">
            <span>{mod.slides_count} slides</span>
            <span>
              {mod.regions
                .map((r) => regions.find((reg) => reg.id === r)?.name ?? r.toUpperCase())
                .join(', ')}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onManage}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hoxton-grey bg-white px-3.5 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
      >
        Manage
      </button>
    </div>
  )
}
