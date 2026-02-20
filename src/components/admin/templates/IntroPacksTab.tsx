import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import { SlideThumb } from './SlideThumb'
import { IntroPackCard } from './IntroPackCard'
import { ManageIntroPackModal } from './ManageIntroPackModal'
import { NewRegionModal } from './NewRegionModal'
import { getSlideUrl } from '../../../lib/storage'
import type { DbRegion } from '../../../types'

interface IntroPacksTabProps {
  regions: DbRegion[]
  userId: string
  onRefresh: () => Promise<void>
}

export function IntroPacksTab({ regions, userId, onRefresh }: IntroPacksTabProps) {
  const [viewRegion, setViewRegion] = useState<DbRegion | null>(null)
  const [manageRegion, setManageRegion] = useState<DbRegion | null>(null)
  const [showNewRegion, setShowNewRegion] = useState(false)

  return (
    <div>
      {/* Action bar */}
      <div className="mb-5 flex items-center justify-end">
        <button
          onClick={() => setShowNewRegion(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-hoxton-turquoise px-3.5 py-2 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
        >
          <Plus className="h-4 w-4" />
          New Region
        </button>
      </div>

      {/* Region cards grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {regions.map((region) => (
          <IntroPackCard
            key={region.id}
            region={region}
            onViewSlides={() => setViewRegion(region)}
            onManage={() => setManageRegion(region)}
          />
        ))}
      </div>

      {regions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm font-heading font-medium text-gray-400">
            No regions configured
          </p>
          <p className="mt-1 text-xs font-body text-gray-400">
            Click "+ New Region" to create your first region
          </p>
        </div>
      )}

      {/* View Slides Modal */}
      {viewRegion && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setViewRegion(null)}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h3 className="font-heading font-semibold text-hoxton-deep">
                    {viewRegion.display_name} — Intro Pack
                  </h3>
                  <p className="text-sm font-body text-gray-400">
                    {viewRegion.intro_slides_count} slides
                  </p>
                </div>
                <button
                  onClick={() => setViewRegion(null)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: viewRegion.intro_slides_count }).map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
                    >
                      <div className="aspect-video overflow-hidden bg-gray-50">
                        <SlideThumb
                          src={getSlideUrl(`intro-${viewRegion.id}/Slide${i + 1}.PNG`)}
                          alt={`Slide ${i + 1}`}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-[11px] font-heading font-medium text-hoxton-deep">
                          Slide {i + 1}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Manage Intro Pack Modal */}
      {manageRegion && (
        <ManageIntroPackModal
          region={manageRegion}
          userId={userId}
          onClose={() => setManageRegion(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* New Region Modal */}
      {showNewRegion && (
        <NewRegionModal
          userId={userId}
          onClose={() => setShowNewRegion(false)}
          onCreated={onRefresh}
        />
      )}
    </div>
  )
}
