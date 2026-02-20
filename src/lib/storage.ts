const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export function getSlideUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/slides/${path}`
}
