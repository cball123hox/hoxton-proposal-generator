import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useTemplateData } from '../hooks/useTemplateData'
import { IntroPacksTab } from '../components/admin/templates/IntroPacksTab'
import { ProductModulesTab } from '../components/admin/templates/ProductModulesTab'

type Tab = 'intro' | 'products'

export function AdminTemplatesPage() {
  const { user } = useAuth()
  const {
    regions,
    productModules,
    categories,
    loading,
    error,
    refreshRegions,
    refreshModules,
    refreshCategories,
  } = useTemplateData()

  const [tab, setTab] = useState<Tab>('intro')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-hoxton-turquoise" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load template data: {error}
      </div>
    )
  }

  const userId = user?.id ?? ''

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">
          Template Library
        </h1>
        <p className="mt-1 text-sm font-body text-hoxton-slate">
          Manage intro packs and product module slides
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex gap-1 rounded-xl bg-white p-1 shadow-sm border border-gray-100">
        {(
          [
            { key: 'intro', label: 'Intro Packs' },
            { key: 'products', label: 'Product Modules' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-heading font-medium transition-colors ${
              tab === t.key
                ? 'bg-hoxton-turquoise text-white shadow-sm'
                : 'text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'intro' && (
        <IntroPacksTab
          regions={regions}
          userId={userId}
          onRefresh={refreshRegions}
        />
      )}
      {tab === 'products' && (
        <ProductModulesTab
          productModules={productModules}
          categories={categories}
          regions={regions}
          userId={userId}
          onRefreshModules={refreshModules}
          onRefreshCategories={refreshCategories}
        />
      )}
    </div>
  )
}
