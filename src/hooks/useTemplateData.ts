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
    setRegions(data as DbRegion[])
  }, [])

  const fetchModules = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('product_modules')
      .select('*')
      .order('sort_order')
    if (err) {
      setError(err.message)
      return
    }
    setProductModules(data as DbProductModule[])
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
