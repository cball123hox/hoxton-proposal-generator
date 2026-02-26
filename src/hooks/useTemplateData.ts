import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DbRegion, DbProductModule, DbCategory } from '../types'

interface TemplateData {
  regions: DbRegion[]
  productModules: DbProductModule[]
  categories: DbCategory[]
  loading: boolean
  error: string | null
  refreshRegions: () => Promise<void>
  refreshModules: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshAll: () => Promise<void>
}

export function useTemplateData(): TemplateData {
  const [regions, setRegions] = useState<DbRegion[]>([])
  const [productModules, setProductModules] = useState<DbProductModule[]>([])
  const [categories, setCategories] = useState<DbCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRegions = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('regions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (err) {
      setError(err.message)
      return
    }

    // Fetch actual slide counts from intro_packs/closing_packs to override denormalized counts
    const [{ data: introPacks }, { data: closingPacks }] = await Promise.all([
      supabase.from('intro_packs').select('region_id, intro_slides(id)').eq('is_active', true),
      supabase.from('closing_packs').select('region_id, closing_slides(id)').eq('is_active', true),
    ])

    const introCountMap = new Map<string, number>()
    for (const pack of (introPacks ?? []) as { region_id: string; intro_slides: unknown }[]) {
      const slides = pack.intro_slides as unknown[]
      introCountMap.set(pack.region_id, Array.isArray(slides) ? slides.length : 0)
    }

    const closingCountMap = new Map<string, number>()
    for (const pack of (closingPacks ?? []) as { region_id: string; closing_slides: unknown }[]) {
      const slides = pack.closing_slides as unknown[]
      closingCountMap.set(pack.region_id, Array.isArray(slides) ? slides.length : 0)
    }

    const regionsWithCounts = (data as DbRegion[]).map((r) => ({
      ...r,
      intro_slides_count: introCountMap.get(r.id) ?? r.intro_slides_count,
      closing_slides_count: closingCountMap.get(r.id) ?? r.closing_slides_count,
    }))

    setRegions(regionsWithCounts)
  }, [])

  const fetchModules = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('product_modules')
      .select('*, product_slides(id)')
      .order('sort_order')
    if (err) {
      setError(err.message)
      return
    }

    // Override denormalized slides_count with actual count from product_slides
    const modulesWithCounts = (data as (DbProductModule & { product_slides?: unknown })[]).map((m) => {
      const slides = m.product_slides as unknown[]
      const actualCount = Array.isArray(slides) ? slides.length : m.slides_count
      const { product_slides: _, ...rest } = m
      return { ...rest, slides_count: actualCount } as DbProductModule
    })

    setProductModules(modulesWithCounts)
  }, [])

  const fetchCategories = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (err) {
      setError(err.message)
      return
    }
    setCategories(data as DbCategory[])
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    await Promise.all([fetchRegions(), fetchModules(), fetchCategories()])
  }, [fetchRegions, fetchModules, fetchCategories])

  useEffect(() => {
    let mounted = true
    async function init() {
      await Promise.all([fetchRegions(), fetchModules(), fetchCategories()])
      if (mounted) setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [fetchRegions, fetchModules, fetchCategories])

  return {
    regions,
    productModules,
    categories,
    loading,
    error,
    refreshRegions: fetchRegions,
    refreshModules: fetchModules,
    refreshCategories: fetchCategories,
    refreshAll,
  }
}
