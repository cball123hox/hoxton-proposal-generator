import fs from 'node:fs'
import path from 'node:path'

export interface SlideOrder {
  id: string
  type: 'image' | 'context' | 'fee'
  imagePath?: string
  label: string
  editableFields?: EditableFieldDef[]
}

export interface EditableFieldDef {
  id: string
  name: string
  label: string
  type: 'text' | 'textarea' | 'table'
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: 'heading' | 'body'
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold'
  color: string
  textAlign: 'left' | 'center' | 'right'
  autoFill?: string
}

export interface ProposalData {
  proposalId: string
  clientName: string
  advisorName: string
  regionId: string
  introSlidesCount: number
  selectedProducts: { id: string; name: string; slides: number }[]
  context: { situation: string; objectives: string; focus: string }
  feeData: Record<string, unknown>
  slideOrder?: SlideOrder[]
  editableFieldsData?: Record<string, Record<string, string>>
  staticAssetsBaseUrl: string
}

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')
}

function renderImageSlide(imageUrl: string, label: string, overlayHtml = ''): string {
  return `
  <div class="slide">
    <img class="slide-image" src="${imageUrl}" alt="${escapeHtml(label)}" />${overlayHtml}
  </div>`
}

function renderEditableFieldOverlays(
  slideId: string,
  fieldsData: Record<string, Record<string, string>>,
  fieldsFromDb?: EditableFieldDef[]
): string {
  if (!fieldsFromDb || fieldsFromDb.length === 0) {
    console.log(`[PDF:overlay] ${slideId}: no field defs`)
    return ''
  }
  const slideValues = fieldsData[slideId]
  if (!slideValues) {
    console.log(`[PDF:overlay] ${slideId}: has ${fieldsFromDb.length} field defs but no values in editableFieldsData`)
    return ''
  }
  console.log(`[PDF:overlay] ${slideId}: rendering ${fieldsFromDb.length} fields with values: ${Object.keys(slideValues).join(', ')}`)

  return fieldsFromDb
    .map((field) => {
      const value = slideValues[field.name]
      if (!value) return ''

      const fontFamily =
        field.fontFamily === 'heading'
          ? "'FT Calhern', 'Helvetica Neue', sans-serif"
          : "'Sentient', Georgia, serif"

      const fontWeightMap: Record<string, string> = {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      }

      if (field.type === 'table') {
        const rows = String(value ?? '').split('\n').filter((r) => r.trim())
        const tableHtml = rows
          .map((row) => {
            const cells = row.split('|').map((c) => c.trim())
            return `<tr>${cells.map((c) => `<td style="padding:2px 6px;border-bottom:1px solid rgba(0,0,0,0.1);font-size:${Math.round(field.fontSize * 0.85)}px;">${escapeHtml(c)}</td>`).join('')}</tr>`
          })
          .join('')

        return `<div style="position:absolute;left:${field.x}%;top:${field.y}%;width:${field.width}%;height:${field.height}%;overflow:hidden;font-family:${fontFamily};color:${field.color};text-align:${field.textAlign};"><table style="width:100%;border-collapse:collapse;">${tableHtml}</table></div>`
      }

      const escapedValue = escapeHtml(String(value ?? ''))

      if (field.type === 'textarea') {
        return `<div style="position:absolute;left:${field.x}%;top:${field.y}%;width:${field.width}%;height:${field.height}%;overflow:hidden;font-family:${fontFamily};font-size:${Math.round(field.fontSize * 0.9)}px;font-weight:${fontWeightMap[field.fontWeight] || '400'};color:${field.color};text-align:${field.textAlign};line-height:1.45;padding:2px 4px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;">${escapedValue}</div>`
      }

      return `<div style="position:absolute;left:${field.x}%;top:${field.y}%;width:${field.width}%;height:${field.height}%;display:flex;align-items:flex-start;overflow:hidden;font-family:${fontFamily};font-size:${field.fontSize}px;font-weight:${fontWeightMap[field.fontWeight] || '400'};color:${field.color};text-align:${field.textAlign};line-height:1.4;padding:2px 4px;white-space:nowrap;"><span style="width:100%;text-align:${field.textAlign};">${escapedValue}</span></div>`
    })
    .join('')
}

function renderContextSlide(
  context: { situation: string; objectives: string; focus: string },
  clientName: string
): string {
  return `
  <div class="slide">
    <div class="slide-content">
      <div class="client-header"></div>
      <h1>Summary of Context</h1>
      <p class="subtitle">Prepared for ${escapeHtml(clientName)}</p>
      <div class="divider"></div>

      ${context.situation ? `
      <div class="section-block">
        <h2>Current Situation</h2>
        <p>${escapeHtml(context.situation)}</p>
      </div>` : ''}

      ${context.objectives ? `
      <div class="section-block">
        <h2>Objectives</h2>
        <p>${escapeHtml(context.objectives)}</p>
      </div>` : ''}

      ${context.focus ? `
      <div class="section-block">
        <h2>Areas of Focus</h2>
        <p>${escapeHtml(context.focus)}</p>
      </div>` : ''}
    </div>
  </div>`
}

function renderFeeSlide(
  feeData: Record<string, unknown>,
  clientName: string
): string {
  const fees = Object.entries(feeData)

  let tableRows = ''
  if (fees.length > 0) {
    tableRows = fees
      .map(
        ([key, value]) =>
          `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(String(value))}</td></tr>`
      )
      .join('\n')
  } else {
    tableRows =
      '<tr><td colspan="2" style="text-align:center; opacity:0.6;">Fee details to be confirmed</td></tr>'
  }

  return `
  <div class="slide">
    <div class="slide-content">
      <div class="client-header"></div>
      <h1>Fee Structure</h1>
      <p class="subtitle">Prepared for ${escapeHtml(clientName)}</p>
      <div class="divider"></div>

      <table class="fee-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  </div>`
}

export function assembleHtml(data: ProposalData): string {
  const templatePath = path.join(__dirname, 'templates', 'slide-base.html')
  let template = fs.readFileSync(templatePath, 'utf-8')

  const { staticAssetsBaseUrl } = data

  // If a custom slide order was provided, use it
  if (data.slideOrder && data.slideOrder.length > 0) {
    const fieldsData = data.editableFieldsData || {}
    const slidesHtml = data.slideOrder
      .map((slide) => {
        switch (slide.type) {
          case 'context':
            return renderContextSlide(data.context, data.clientName)
          case 'fee':
            return renderFeeSlide(data.feeData, data.clientName)
          case 'image':
          default: {
            const imageUrl = slide.imagePath
              ? slide.imagePath.startsWith('http')
                ? slide.imagePath
                : `${staticAssetsBaseUrl}${slide.imagePath}`
              : ''
            const overlayHtml = renderEditableFieldOverlays(slide.id, fieldsData, slide.editableFields)
            return renderImageSlide(imageUrl, slide.label, overlayHtml)
          }
        }
      })
      .join('\n')

    template = template.replace('{{clientName}}', escapeHtml(data.clientName))
    template = template.replace('{{slides}}', slidesHtml)
    // Replace font URLs with absolute paths
    template = template.replace(
      /url\('\/fonts\//g,
      `url('${staticAssetsBaseUrl}/fonts/`
    )
    return template
  }

  // Default slide order (matches the frontend StepPreviewGenerate logic)
  const slidesHtml: string[] = []

  // Use Supabase Storage URL for slides if available, otherwise fall back to static assets
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const slideBase = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/slides`
    : `${staticAssetsBaseUrl}/slides`

  // 1. Intro slides
  for (let i = 1; i <= data.introSlidesCount; i++) {
    slidesHtml.push(
      renderImageSlide(
        `${slideBase}/intro-${data.regionId}/Slide${i}.PNG`,
        `Introduction Slide ${i}`
      )
    )
  }

  // 2. Areas of Focus divider
  slidesHtml.push(
    renderImageSlide(
      `${slideBase}/dividers/areas-of-focus.PNG`,
      'Areas of Focus'
    )
  )

  // 3. Summary of Context (editable)
  slidesHtml.push(renderContextSlide(data.context, data.clientName))

  // 4. Product slides
  for (const product of data.selectedProducts) {
    for (let i = 1; i <= product.slides; i++) {
      slidesHtml.push(
        renderImageSlide(
          `${slideBase}/products/${product.id}/Slide${i}.PNG`,
          `${product.name} — Slide ${i}`
        )
      )
    }
  }

  // 5. Closing slides (come via slideOrder when available; omitted in default path)

  template = template.replace('{{clientName}}', escapeHtml(data.clientName))
  template = template.replace('{{slides}}', slidesHtml.join('\n'))
  // Replace font URLs with absolute paths
  template = template.replace(
    /url\('\/fonts\//g,
    `url('${staticAssetsBaseUrl}/fonts/`
  )
  return template
}
