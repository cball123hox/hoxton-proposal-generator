import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { assembleHtml, type ProposalData } from './assemble-html.js'

export interface GenerateResult {
  pdfPath: string
}

export async function generatePdf(data: ProposalData): Promise<GenerateResult> {
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const html = assembleHtml(data)

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  try {
    const page = await browser.newPage()

    // Set viewport to slide dimensions
    await page.setViewport({ width: 1280, height: 720 })

    // Load the HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready)

    // Generate PDF
    const pdfBuffer = await page.pdf({
      width: '1280px',
      height: '720px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    })

    console.log(`[PDF] PDF buffer size: ${pdfBuffer.byteLength} bytes`)

    // Upload to Supabase Storage using service role key
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    // Convert Uint8Array to Buffer for Supabase compatibility
    const buffer = Buffer.from(pdfBuffer)

    const timestamp = Date.now()
    const safeName = data.clientName.replace(/[^a-zA-Z0-9-_]/g, '_')
    const pdfPath = `${data.proposalId}/${safeName}_${timestamp}.pdf`
    console.log(`[PDF] Uploading to bucket "proposals", path: ${pdfPath}, buffer size: ${buffer.byteLength}`)

    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('proposals')
      .upload(pdfPath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('[PDF] Upload error details:', JSON.stringify(uploadError, null, 2))
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }
    console.log('[PDF] Upload successful:', uploadData)

    // Update the proposal record with just the storage path
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        pdf_path: pdfPath,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq('id', data.proposalId)

    if (updateError) {
      console.error('[PDF] Failed to update proposal record:', updateError.message)
    }

    return { pdfPath }
  } finally {
    await browser.close()
  }
}
