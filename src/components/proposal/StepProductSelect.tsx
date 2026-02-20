import { useState } from 'react'
import { Check, Search, Layers, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Portal } from '../ui/Portal'
import { PRODUCT_MODULES, CATEGORIES } from '../../lib/constants'
import { getSlideUrl } from '../../lib/storage'
import type { ProposalDraft } from '../../types'

interface StepProductSelectProps {
  draft: ProposalDraft
  updateDraft: (updates: Partial<ProposalDraft>) => void
}

function SlideImage({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-hoxton-deep ${className}`}
      >
        <span className="px-1.5 text-center text-[9px] font-heading font-medium leading-tight text-white/80">
          {alt}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  )
}

export function StepProductSelect({ draft, updateDraft }: StepProductSelectProps) {
  const [search, setSearch] = useState('')
  const [previewProduct, setPreviewProduct] = useState<string | null>(null)
  const [previewSlide, setPreviewSlide] = useState(0)

  const regionProducts = PRODUCT_MODULES.filter((p) =>
    p.regions.includes(draft.regionId)
  )

  const filtered = search.trim()
    ? regionProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.category.toLowerCase().includes(search.toLowerCase())
      )
    : regionProducts

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    products: filtered.filter((p) => p.category === cat),
  })).filter((g) => g.products.length > 0)

  function toggleProduct(id: string) {
    const selected = draft.selectedProducts.includes(id)
      ? draft.selectedProducts.filter((p) => p !== id)
      : [...draft.selectedProducts, id]
    updateDraft({ selectedProducts: selected })
  }

  const previewMod = previewProduct
    ? PRODUCT_MODULES.find((p) => p.id === previewProduct)
    : null

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
            Discussion Areas
          </h2>
          <p className="mt-1 text-sm font-body text-hoxton-slate">
            Choose the product modules to include in this proposal
            {draft.selectedProducts.length > 0 && (
              <span className="ml-2 font-heading font-semibold text-hoxton-turquoise">
                {draft.selectedProducts.length} selected
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-4 mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hoxton-slate/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter products..."
          className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light py-2.5 pl-10 pr-4 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
        />
      </div>

      {/* Product Groups */}
      <div className="space-y-6">
        {grouped.map(({ category, products }) => (
          <div key={category}>
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-hoxton-slate" />
              <h3 className="text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                {category}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const isSelected = draft.selectedProducts.includes(product.id)

                return (
                  <div
                    key={product.id}
                    className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-hoxton-turquoise bg-hoxton-turquoise/5'
                        : 'border-hoxton-grey bg-white hover:border-hoxton-slate/40'
                    }`}
                  >
                    <button
                      onClick={() => toggleProduct(product.id)}
                      className="flex w-full items-start gap-3 p-2.5 text-left"
                    >
                      {/* Compact thumbnail */}
                      <div className="relative w-[90px] shrink-0 overflow-hidden rounded-lg">
                        <div className="aspect-video">
                          <SlideImage
                            src={getSlideUrl(`products/${product.id}/Slide1.PNG`)}
                            alt={product.name}
                            className="h-full w-full"
                          />
                        </div>
                        {isSelected && (
                          <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-hoxton-turquoise text-white shadow">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1 py-0.5">
                        <h4 className="text-sm font-heading font-medium leading-snug text-hoxton-deep">
                          {product.name}
                        </h4>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs font-body text-gray-400">
                            {product.slides} slides
                          </span>
                          {product.layout === 'old' && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-heading font-semibold uppercase text-amber-700">
                              Legacy
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Preview button on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewProduct(product.id)
                        setPreviewSlide(0)
                      }}
                      className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-heading font-medium text-hoxton-deep opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100"
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {regionProducts.length === 0 && (
        <div className="rounded-2xl border border-hoxton-grey bg-white px-6 py-12 text-center">
          <p className="font-heading font-medium text-hoxton-deep">
            Select a region first
          </p>
          <p className="mt-1 text-sm font-body text-gray-400">
            Go back to Step 2 to choose a region
          </p>
        </div>
      )}

      {/* Preview Modal */}
      {previewMod && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="font-heading font-semibold text-hoxton-deep">
                  {previewMod.name}
                </h3>
                <p className="text-sm font-body text-gray-400">
                  Slide {previewSlide + 1} of {previewMod.slides}
                </p>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center p-6">
              <button
                onClick={() => setPreviewSlide(Math.max(0, previewSlide - 1))}
                disabled={previewSlide === 0}
                className="mr-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep disabled:opacity-30"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg border border-gray-100">
                <SlideImage
                  src={getSlideUrl(`products/${previewMod.id}/Slide${previewSlide + 1}.PNG`)}
                  alt={`${previewMod.name} — Slide ${previewSlide + 1}`}
                  className="h-full w-full"
                />
              </div>
              <button
                onClick={() =>
                  setPreviewSlide(Math.min(previewMod.slides - 1, previewSlide + 1))
                }
                disabled={previewSlide === previewMod.slides - 1}
                className="ml-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep disabled:opacity-30"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            <div className="border-t border-gray-100 px-6 py-4">
              <div className="flex gap-2 overflow-x-auto">
                {Array.from({ length: previewMod.slides }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewSlide(i)}
                    className={`shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      i === previewSlide
                        ? 'border-hoxton-turquoise shadow'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="h-14 w-24">
                      <SlideImage
                        src={getSlideUrl(`products/${previewMod.id}/Slide${i + 1}.PNG`)}
                        alt={`Slide ${i + 1}`}
                        className="h-full w-full"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
