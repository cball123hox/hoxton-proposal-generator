/**
 * Sync Supabase Storage slide files → database records.
 *
 * Lists the "slides" bucket and creates missing intro_slides / product_slides
 * rows so that editable-field definitions can be persisted.
 *
 * Usage:
 *   npx tsx scripts/sync-slides-db.ts
 *
 * Requires VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local or as environment variables.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Load .env.local (no dotenv dependency) ──────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract slide number from a filename like "Slide3.PNG" → 3 */
function extractSlideNumber(fileName: string): number | null {
  const match = fileName.match(/Slide(\d+)\./i)
  return match ? parseInt(match[1], 10) : null
}

/** List all files under a given prefix in the slides bucket */
async function listStorageFiles(prefix: string): Promise<string[]> {
  const files: string[] = []
  const { data, error } = await supabase.storage
    .from('slides')
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  if (error) {
    console.error(`  Error listing ${prefix}:`, error.message)
    return files
  }

  for (const item of data || []) {
    // Skip .emptyFolderPlaceholder and folders
    if (item.id && !item.metadata) {
      // It's a folder — recurse
      const nested = await listStorageFiles(`${prefix}/${item.name}`)
      files.push(...nested)
    } else if (item.name && /\.(png|jpg|jpeg)$/i.test(item.name)) {
      files.push(`${prefix}/${item.name}`)
    }
  }
  return files
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let introSlidesCreated = 0
  let productSlidesCreated = 0

  // ── 1. Discover top-level folders in the bucket ──
  const { data: topLevel, error: topErr } = await supabase.storage
    .from('slides')
    .list('', { limit: 100 })

  if (topErr) {
    console.error('Failed to list storage bucket:', topErr.message)
    process.exit(1)
  }

  const introFolders: string[] = []
  let hasProductsFolder = false

  for (const item of topLevel || []) {
    if (item.name.startsWith('intro-')) {
      introFolders.push(item.name)
    }
    if (item.name === 'products') {
      hasProductsFolder = true
    }
  }

  console.log(`Found intro folders: ${introFolders.join(', ') || '(none)'}`)
  console.log(`Products folder exists: ${hasProductsFolder}\n`)

  // ── 2. Sync intro slides ──
  for (const folder of introFolders) {
    const regionId = folder.replace('intro-', '') // e.g. "uk", "asia", "int", "jp"
    console.log(`── Intro: ${folder} (region: ${regionId}) ──`)

    // Find the region record
    const { data: regionRow } = await supabase
      .from('regions')
      .select('id')
      .eq('id', regionId)
      .single()

    if (!regionRow) {
      console.log(`  ⚠ Region "${regionId}" not found in DB — skipping`)
      continue
    }

    // Get or create intro_pack
    let { data: pack } = await supabase
      .from('intro_packs')
      .select('*')
      .eq('region_id', regionId)
      .eq('is_active', true)
      .single()

    if (!pack) {
      const { data: newPack, error: packErr } = await supabase
        .from('intro_packs')
        .insert({ region_id: regionId, name: `${regionId.toUpperCase()} Intro Pack` })
        .select('*')
        .single()

      if (packErr || !newPack) {
        console.error(`  ✗ Failed to create intro_pack:`, packErr?.message)
        continue
      }
      pack = newPack
      console.log(`  Created intro_pack: ${pack.id}`)
    } else {
      console.log(`  Found intro_pack: ${pack.id}`)
    }

    // List files in this folder
    const files = await listStorageFiles(folder)
    console.log(`  ${files.length} slide file(s) in storage`)

    // Get existing slide records for this pack
    const { data: existingSlides } = await supabase
      .from('intro_slides')
      .select('slide_number')
      .eq('intro_pack_id', pack.id)

    const existingNumbers = new Set(
      (existingSlides || []).map((s: { slide_number: number }) => s.slide_number)
    )

    // Create missing records
    const toInsert: Array<{
      intro_pack_id: string
      slide_number: number
      title: string
      slide_type: string
      image_path: string
    }> = []

    for (const filePath of files) {
      const fileName = filePath.split('/').pop()!
      const slideNum = extractSlideNumber(fileName)
      if (slideNum === null) {
        console.log(`  ⚠ Skipping unrecognised filename: ${fileName}`)
        continue
      }

      if (existingNumbers.has(slideNum)) {
        continue // already exists
      }

      toInsert.push({
        intro_pack_id: pack.id,
        slide_number: slideNum,
        title: `Slide ${slideNum}`,
        slide_type: 'static',
        image_path: filePath,
      })
    }

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('intro_slides')
        .insert(toInsert)

      if (insertErr) {
        console.error(`  ✗ Insert error:`, insertErr.message)
      } else {
        console.log(`  ✓ Created ${toInsert.length} intro_slides record(s)`)
        introSlidesCreated += toInsert.length
      }
    } else {
      console.log(`  – All records already exist`)
    }

    // Update regions.intro_slides_count to match total files
    const totalCount = existingNumbers.size + toInsert.length
    await supabase
      .from('regions')
      .update({ intro_slides_count: totalCount })
      .eq('id', regionId)
  }

  // ── 3. Sync product slides ──
  if (hasProductsFolder) {
    // List product subfolders
    const { data: productFolders } = await supabase.storage
      .from('slides')
      .list('products', { limit: 200 })

    for (const folder of productFolders || []) {
      const moduleId = folder.name // e.g. "sipp-intl"
      console.log(`\n── Product: products/${moduleId} ──`)

      // Verify module exists
      const { data: moduleRow } = await supabase
        .from('product_modules')
        .select('id')
        .eq('id', moduleId)
        .single()

      if (!moduleRow) {
        console.log(`  ⚠ Module "${moduleId}" not found in DB — skipping`)
        continue
      }

      // List files
      const files = await listStorageFiles(`products/${moduleId}`)
      console.log(`  ${files.length} slide file(s) in storage`)

      // Get existing slide records
      const { data: existingSlides } = await supabase
        .from('product_slides')
        .select('slide_number')
        .eq('module_id', moduleId)

      const existingNumbers = new Set(
        (existingSlides || []).map((s: { slide_number: number }) => s.slide_number)
      )

      // Create missing records
      const toInsert: Array<{
        module_id: string
        slide_number: number
        title: string
        slide_type: string
        image_path: string
      }> = []

      for (const filePath of files) {
        const fileName = filePath.split('/').pop()!
        const slideNum = extractSlideNumber(fileName)
        if (slideNum === null) {
          console.log(`  ⚠ Skipping unrecognised filename: ${fileName}`)
          continue
        }

        if (existingNumbers.has(slideNum)) {
          continue
        }

        toInsert.push({
          module_id: moduleId,
          slide_number: slideNum,
          title: `Slide ${slideNum}`,
          slide_type: 'static',
          image_path: filePath,
        })
      }

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('product_slides')
          .insert(toInsert)

        if (insertErr) {
          console.error(`  ✗ Insert error:`, insertErr.message)
        } else {
          console.log(`  ✓ Created ${toInsert.length} product_slides record(s)`)
          productSlidesCreated += toInsert.length
        }
      } else {
        console.log(`  – All records already exist`)
      }

      // Update product_modules.slides_count
      const totalCount = existingNumbers.size + toInsert.length
      await supabase
        .from('product_modules')
        .update({ slides_count: totalCount })
        .eq('id', moduleId)
    }
  }

  // ── 4. Summary ──
  console.log(
    `\n✅ Done. Created ${introSlidesCreated} intro_slides records and ${productSlidesCreated} product_slides records.`
  )
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
