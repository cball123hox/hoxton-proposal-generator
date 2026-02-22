import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { generatePdf } from './generate-pdf.js'
import type { ProposalData, SlideOrder } from './assemble-html.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// CORS — restrict to allowed origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`)
        console.warn(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`)
        callback(null, false)
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json({ limit: '10mb' }))

// Simple in-memory rate limiter for /generate
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 10

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip)?.filter((t) => now - t < RATE_LIMIT_WINDOW) ?? []
  if (timestamps.length >= RATE_LIMIT_MAX) return false
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return true
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, timestamps] of rateLimitMap) {
    const active = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW)
    if (active.length === 0) rateLimitMap.delete(ip)
    else rateLimitMap.set(ip, active)
  }
}, 5 * 60_000)

/**
 * Fetch editable field definitions from DB and merge into slideOrder.
 * Uses service role key to bypass RLS.
 */
async function enrichSlideOrderWithFieldDefs(
  slideOrder: SlideOrder[],
  regionId: string
): Promise<SlideOrder[]> {
  if (!slideOrder || slideOrder.length === 0) return slideOrder

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const fieldMap: Record<string, unknown[]> = {}

  // Fetch intro slide fields
  try {
    const { data: introPack } = await supabase
      .from('intro_packs')
      .select('id')
      .eq('region_id', regionId)
      .eq('is_active', true)
      .single()

    if (introPack) {
      const { data: introSlides } = await supabase
        .from('intro_slides')
        .select('slide_number, editable_fields')
        .eq('intro_pack_id', introPack.id)

      if (introSlides) {
        for (const s of introSlides) {
          const fields = Array.isArray(s.editable_fields) ? s.editable_fields : []
          if (fields.length > 0) {
            fieldMap[`intro-${s.slide_number}`] = fields
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PDF] Failed to fetch intro field defs:', err)
  }

  // Fetch product slide fields — extract unique module IDs from slide order
  const productModuleIds = new Set<string>()
  for (const slide of slideOrder) {
    const match = slide.id?.match(/^product-(.+)-(\d+)$/)
    if (match) productModuleIds.add(match[1])
  }

  for (const modId of productModuleIds) {
    try {
      const { data: productSlides } = await supabase
        .from('product_slides')
        .select('slide_number, editable_fields')
        .eq('module_id', modId)

      if (productSlides) {
        for (const s of productSlides) {
          const fields = Array.isArray(s.editable_fields) ? s.editable_fields : []
          if (fields.length > 0) {
            fieldMap[`product-${modId}-${s.slide_number}`] = fields
          }
        }
      }
    } catch (err) {
      console.warn(`[PDF] Failed to fetch product field defs for ${modId}:`, err)
    }
  }

  console.log(`[PDF] Field defs from DB: ${Object.keys(fieldMap).length} slides have fields`)

  // Merge: prefer client-sent defs, fall back to DB defs
  return slideOrder.map((slide) => ({
    ...slide,
    editableFields:
      (slide.editableFields && slide.editableFields.length > 0)
        ? slide.editableFields
        : (fieldMap[slide.id] as SlideOrder['editableFields']) || undefined,
  }))
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hoxton-pdf-service', version: '1.0.0' })
})

// PDF generation endpoint
app.post('/generate', async (req, res) => {
  // Rate limiting
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'
  if (!rateLimit(clientIp)) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment before trying again.',
    })
    return
  }

  try {
    const {
      proposalId,
      clientName,
      advisorName,
      regionId,
      introSlidesCount,
      selectedProducts,
      context,
      feeData,
      slideOrder,
      editableFieldsData,
      staticAssetsBaseUrl,
    } = req.body

    // Validate required fields
    if (!proposalId || !clientName || !regionId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: proposalId, clientName, regionId',
      })
      return
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({
        success: false,
        error: 'Server misconfigured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment',
      })
      return
    }

    if (!selectedProducts || !Array.isArray(selectedProducts)) {
      res.status(400).json({
        success: false,
        error: 'selectedProducts must be an array',
      })
      return
    }

    // Enrich slide order with field definitions from DB (service role bypasses RLS)
    const enrichedSlideOrder = slideOrder
      ? await enrichSlideOrderWithFieldDefs(slideOrder, regionId)
      : undefined

    const fieldsDataObj = editableFieldsData || {}
    console.log(
      `[PDF] editableFieldsData keys: ${Object.keys(fieldsDataObj).join(', ') || '(none)'}`
    )
    for (const [slideId, values] of Object.entries(fieldsDataObj)) {
      console.log(`[PDF]   ${slideId}: ${Object.keys(values as Record<string, unknown>).join(', ')}`)
    }

    const proposalData: ProposalData = {
      proposalId,
      clientName,
      advisorName: advisorName || '',
      regionId,
      introSlidesCount: introSlidesCount ?? 0,
      selectedProducts,
      context: context || { situation: '', objectives: '', focus: '' },
      feeData: feeData || {},
      slideOrder: enrichedSlideOrder,
      editableFieldsData: fieldsDataObj,
      staticAssetsBaseUrl: staticAssetsBaseUrl || process.env.STATIC_ASSETS_BASE_URL || '',
    }

    console.log(
      `[PDF] Generating for proposal ${proposalId} (${clientName}, ${selectedProducts.length} products)`
    )

    const result = await generatePdf(proposalData)

    console.log(`[PDF] Generated successfully: ${result.pdfPath}`)

    res.json({
      success: true,
      pdfPath: result.pdfPath,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[PDF] Generation failed:', message)
    res.status(500).json({ success: false, error: message })
  }
})

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[PDF Service] Running on 0.0.0.0:${PORT}`)
  console.log(`[PDF] Supabase URL: ${SUPABASE_URL}`)
  console.log(`[PDF] Service role key: ${SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING'}`)
  console.log(`[PDF] Allowed origins: ${allowedOrigins.join(', ')}`)
})
