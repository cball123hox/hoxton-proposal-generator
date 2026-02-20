import { Eye, Settings } from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { SlideThumb } from './SlideThumb'
import { getSlideUrl } from '../../../lib/storage'
import type { DbRegion } from '../../../types'

interface IntroPackCardProps {
  region: DbRegion
  onViewSlides: () => void
  onManage: () => void
}

export function IntroPackCard({ region, onViewSlides, onManage }: IntroPackCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-heading font-semibold text-hoxton-deep">
            {region.display_name}
          </h3>
          <p className="mt-0.5 text-sm font-body text-hoxton-slate">
            {region.intro_slides_count} slides
          </p>
        </div>
        <Badge variant="info">{region.name}</Badge>
      </div>

      {/* Mini slide strip */}
      <div className="mb-4 flex gap-1.5 overflow-hidden">
        {region.intro_slides_count > 0 ? (
          <>
            {Array.from({ length: Math.min(6, region.intro_slides_count) }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-16 shrink-0 overflow-hidden rounded border border-gray-100 bg-gray-50"
              >
                <SlideThumb
                  src={getSlideUrl(`intro-${region.id}/Slide${i + 1}.PNG`)}
                  alt={`Slide ${i + 1}`}
                  className="h-full w-full"
                />
              </div>
            ))}
            {region.intro_slides_count > 6 && (
              <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded border border-gray-100 bg-gray-50">
                <span className="text-[10px] font-heading font-medium text-gray-400">
                  +{region.intro_slides_count - 6}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-10 items-center">
            <span className="text-xs font-body text-gray-400 italic">
              No slides uploaded yet
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onViewSlides}
          disabled={region.intro_slides_count === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hoxton-grey bg-white px-3.5 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eye className="h-3.5 w-3.5" />
          View Slides
        </button>
        <button
          onClick={onManage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hoxton-grey bg-white px-3.5 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
        >
          <Settings className="h-3.5 w-3.5" />
          Manage
        </button>
      </div>
    </div>
  )
}
