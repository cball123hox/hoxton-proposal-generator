import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CategoryManager } from './CategoryManager'
import { CategorySection } from './CategorySection'
import { ProductModuleRow } from './ProductModuleRow'
import { ManageProductModal } from './ManageProductModal'
import { NewProductModuleModal } from './NewProductModuleModal'
import type { DbProductModule, DbCategory, DbRegion } from '../../../types'

interface ProductModulesTabProps {
  productModules: DbProductModule[]
  categories: DbCategory[]
  regions: DbRegion[]
  userId: string
  onRefreshModules: () => Promise<void>
  onRefreshCategories: () => Promise<void>
}

export function ProductModulesTab({
  productModules,
  categories,
  regions,
  userId,
  onRefreshModules,
  onRefreshCategories,
}: ProductModulesTabProps) {
  const [manageModule, setManageModule] = useState<DbProductModule | null>(null)
  const [showNewModule, setShowNewModule] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  function toggleCategory(categoryId: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  function handleModuleCreated(mod: DbProductModule) {
    setShowNewModule(false)
    onRefreshModules().then(() => {
      // Open manage modal for the new module
      setManageModule(mod)
    })
  }

  return (
    <div>
      {/* Category Manager */}
      <CategoryManager
        categories={categories}
        productModules={productModules}
        userId={userId}
        onRefresh={async () => {
          await onRefreshCategories()
          await onRefreshModules()
        }}
      />

      {/* Action bar */}
      <div className="mb-5 flex items-center justify-end">
        <button
          onClick={() => setShowNewModule(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-hoxton-turquoise px-3.5 py-2 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
        >
          <Plus className="h-4 w-4" />
          New Module
        </button>
      </div>

      {/* Category sections */}
      <div className="space-y-8">
        {categories.map((category) => {
          const mods = productModules.filter((m) => m.category_id === category.id)
          if (mods.length === 0) return null

          return (
            <CategorySection
              key={category.id}
              categoryName={category.name}
              moduleCount={mods.length}
              isExpanded={!collapsedCategories.has(category.id)}
              onToggle={() => toggleCategory(category.id)}
            >
              {mods.map((mod) => (
                <ProductModuleRow
                  key={mod.id}
                  module={mod}
                  regions={regions}
                  onManage={() => setManageModule(mod)}
                />
              ))}
            </CategorySection>
          )
        })}

        {/* Show modules not matching any category (edge case) */}
        {(() => {
          const categoryIds = new Set(categories.map((c) => c.id))
          const uncategorized = productModules.filter((m) => !categoryIds.has(m.category_id))
          if (uncategorized.length === 0) return null
          return (
            <CategorySection
              categoryName="Uncategorized"
              moduleCount={uncategorized.length}
              isExpanded={!collapsedCategories.has('__uncategorized')}
              onToggle={() => toggleCategory('__uncategorized')}
            >
              {uncategorized.map((mod) => (
                <ProductModuleRow
                  key={mod.id}
                  module={mod}
                  regions={regions}
                  onManage={() => setManageModule(mod)}
                />
              ))}
            </CategorySection>
          )
        })()}
      </div>

      {productModules.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm font-heading font-medium text-gray-400">
            No product modules configured
          </p>
          <p className="mt-1 text-xs font-body text-gray-400">
            Click "+ New Module" to create your first product module
          </p>
        </div>
      )}

      {/* Manage Product Modal */}
      {manageModule && (
        <ManageProductModal
          module={manageModule}
          regions={regions}
          userId={userId}
          onClose={() => setManageModule(null)}
          onRefresh={onRefreshModules}
        />
      )}

      {/* New Product Module Modal */}
      {showNewModule && (
        <NewProductModuleModal
          categories={categories}
          regions={regions}
          userId={userId}
          onClose={() => setShowNewModule(false)}
          onCreated={handleModuleCreated}
        />
      )}
    </div>
  )
}
