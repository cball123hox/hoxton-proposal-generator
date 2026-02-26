import { supabase } from './supabase'

export interface UploadProgress {
  total: number
  completed: number
  currentFile: string
}

export interface UploadResult {
  path: string
  slideNumber: number
  error?: string
}

const MAX_CONCURRENT = 3

/**
 * Upload multiple slide files to Supabase Storage.
 * Files are auto-numbered as Slide1.PNG, Slide2.PNG, etc.
 * @param files - Files to upload (in desired order)
 * @param storagePath - e.g. "products/sipp-intl" or "intro-uk"
 * @param startNumber - starting slide number (default 1)
 * @param onProgress - progress callback
 */
export async function uploadSlides(
  files: File[],
  storagePath: string,
  startNumber = 1,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  let completed = 0

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < files.length; i += MAX_CONCURRENT) {
    const batch = files.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.all(
      batch.map(async (file, batchIdx) => {
        const slideNumber = startNumber + i + batchIdx
        const filePath = `${storagePath}/Slide${slideNumber}.PNG`

        console.log(`[Upload] Uploading slide ${slideNumber}: bucket=slides, path=${filePath}, size=${file.size}, type=${file.type}`)

        onProgress?.({
          total: files.length,
          completed,
          currentFile: `Slide${slideNumber}.PNG`,
        })

        const { error } = await supabase.storage
          .from('slides')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'image/png',
          })

        completed++
        onProgress?.({
          total: files.length,
          completed,
          currentFile: `Slide${slideNumber}.PNG`,
        })

        if (error) {
          console.error(`[Upload] FAILED slide ${slideNumber}: path=${filePath}, error=${error.message}`, error)
          return { path: filePath, slideNumber, error: error.message }
        }
        console.log(`[Upload] SUCCESS slide ${slideNumber}: path=${filePath}`)
        return { path: filePath, slideNumber }
      })
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Replace a single slide in storage.
 */
export async function replaceSingleSlide(
  file: File,
  storagePath: string,
  slideNumber: number
): Promise<UploadResult> {
  const filePath = `${storagePath}/Slide${slideNumber}.PNG`

  const { error } = await supabase.storage
    .from('slides')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || 'image/png',
    })

  if (error) {
    return { path: filePath, slideNumber, error: error.message }
  }
  return { path: filePath, slideNumber }
}

/**
 * Delete a single slide file from storage.
 */
export async function deleteSlideFile(
  storagePath: string,
  slideNumber: number
): Promise<{ error?: string }> {
  const filePath = `${storagePath}/Slide${slideNumber}.PNG`

  const { error } = await supabase.storage
    .from('slides')
    .remove([filePath])

  if (error) {
    return { error: error.message }
  }
  return {}
}

/**
 * Remove all slides from a storage path.
 */
export async function deleteAllSlides(
  storagePath: string,
  totalSlides: number
): Promise<void> {
  const paths = Array.from({ length: totalSlides }, (_, i) =>
    `${storagePath}/Slide${i + 1}.PNG`
  )
  if (paths.length > 0) {
    await supabase.storage.from('slides').remove(paths)
  }
}
