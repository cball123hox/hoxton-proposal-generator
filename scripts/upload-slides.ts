/**
 * Upload slide PNGs from public/slides/ to Supabase Storage "slides" bucket.
 *
 * Usage:
 *   npx tsx scripts/upload-slides.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or env vars.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local manually (avoids dotenv dependency)
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
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

const SLIDES_DIR = path.resolve(__dirname, '..', 'public', 'slides')

/** Recursively find all files under a directory */
function walkDir(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

async function main() {
  console.log(`Scanning ${SLIDES_DIR} for files...`)

  const files = walkDir(SLIDES_DIR)
  const pngFiles = files.filter((f) =>
    /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f)
  )

  if (pngFiles.length === 0) {
    console.log('No image files found in public/slides/. Nothing to upload.')
    return
  }

  console.log(`Found ${pngFiles.length} image file(s). Uploading...`)

  let uploaded = 0
  let skipped = 0
  let errors = 0

  for (const filePath of pngFiles) {
    // Relative path from public/slides/ e.g. "intro-uk/Slide1.PNG"
    const relativePath = path.relative(SLIDES_DIR, filePath)
    // Normalise to forward slashes for storage
    const storagePath = relativePath.replace(/\\/g, '/')

    const fileBuffer = fs.readFileSync(filePath)
    const contentType = filePath.toLowerCase().endsWith('.svg')
      ? 'image/svg+xml'
      : filePath.toLowerCase().endsWith('.png')
        ? 'image/png'
        : filePath.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : filePath.toLowerCase().endsWith('.gif')
            ? 'image/gif'
            : 'image/jpeg'

    const { error } = await supabase.storage
      .from('slides')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error(`  ✗ ${storagePath}: ${error.message}`)
      errors++
    } else {
      console.log(`  ✓ ${storagePath}`)
      uploaded++
    }
  }

  console.log(
    `\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}, Errors: ${errors}`
  )
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
