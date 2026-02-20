import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { generatePdf } from './generate-pdf.js'
import type { ProposalData } from './assemble-html.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hoxton-pdf-service' })
})

// PDF generation endpoint
app.post('/generate', async (req, res) => {
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

    const proposalData: ProposalData = {
      proposalId,
      clientName,
      advisorName: advisorName || '',
      regionId,
      introSlidesCount: introSlidesCount ?? 0,
      selectedProducts,
      context: context || { situation: '', objectives: '', focus: '' },
      feeData: feeData || {},
      slideOrder,
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

app.listen(PORT, () => {
  console.log(`[PDF Service] Running on port ${PORT}`)
  console.log(`[PDF] Supabase URL: ${SUPABASE_URL}`)
  console.log(`[PDF] Service role key: ${SUPABASE_SERVICE_ROLE_KEY ? 'set ✓' : 'MISSING ✗'}`)
})
