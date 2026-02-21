import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  FileText,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import type { ProposalDraft } from '../../types'

type InputMode = 'paste' | 'upload'

interface StepTranscriptProps {
  draft: ProposalDraft
  updateDraft: (updates: Partial<ProposalDraft>) => void
  onSkip: () => void
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/pdf': ['.pdf'],
}

const ACCEPT_STRING = '.txt,.md,.docx,.pdf'

async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'txt' || ext === 'md') {
    return file.text()
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? (item.str ?? '') : '')).join(' '))
    }
    return pages.join('\n\n')
  }

  throw new Error(`Unsupported file type: .${ext}`)
}

export function StepTranscript({ draft, updateDraft, onSkip }: StepTranscriptProps) {
  const [mode, setMode] = useState<InputMode>('paste')
  const [summarising, setSummarising] = useState(false)
  const [summarised, setSummarised] = useState(false)
  const [error, setError] = useState('')

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function clearState() {
    if (summarised) setSummarised(false)
    if (error) setError('')
  }

  // Elapsed seconds counter while summarising with AI
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!summarising) {
      setElapsed(0)
      return
    }
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [summarising])

  async function handleSummarise() {
    setSummarising(true)
    setError('')

    logger.log('[StepTranscript] Starting summarise, transcript length:', draft.transcript.length)

    try {
      logger.log('[StepTranscript] Calling supabase.functions.invoke...')
      const { data, error: fnError } = await supabase.functions.invoke(
        'parse-transcript',
        { body: { transcript: draft.transcript } }
      )
      logger.log('[StepTranscript] Response received:', { data, fnError })

      if (fnError) {
        // Extract the actual error body from the edge function response
        let detail = fnError.message
        logger.error('[StepTranscript] Function error:', fnError)
        try {
          if (fnError.context && typeof fnError.context.json === 'function') {
            const body = await fnError.context.json()
            logger.error('[StepTranscript] Error body:', body)
            detail = body?.error || body?.details || detail
          }
        } catch (_e) {
          // context.json() failed — use the generic message
        }
        throw new Error(detail)
      }

      if (!data?.situation || !data?.objectives || !data?.focus) {
        logger.error('[StepTranscript] Missing fields in response:', data)
        throw new Error(data?.error ?? 'Unexpected response from AI')
      }

      const context = {
        situation: data.situation,
        objectives: data.objectives,
        focus: data.focus,
      }

      updateDraft({ aiParsedContext: context, context })
      setSummarised(true)
      logger.log('[StepTranscript] Summary successful')
    } catch (err) {
      logger.error('[StepTranscript] Summary error:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to summarise transcript. Please try again or fill in manually.'
      )
    } finally {
      setSummarising(false)
    }
  }

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

  async function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['txt', 'md', 'docx', 'pdf'].includes(ext ?? '')) {
      setUploadError('Unsupported file type. Please upload .txt, .md, .docx, or .pdf')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File is too large. Maximum size is 20MB.')
      return
    }

    setUploading(true)
    setUploadError('')
    clearState()

    try {
      const text = await extractText(file)
      if (!text.trim()) {
        throw new Error('No text could be extracted from this file')
      }
      updateDraft({ transcript: text })
      setUploadedFile(file.name)
    } catch (err) {
      logger.error('File extraction error:', err)
      setUploadError(
        err instanceof Error ? err.message : 'Failed to read file'
      )
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveFile() {
    setUploadedFile(null)
    updateDraft({ transcript: '' })
    clearState()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
          Call Transcript
        </h2>
        <span className="rounded-full bg-hoxton-grey px-2.5 py-0.5 text-xs font-heading font-medium text-hoxton-slate">
          Optional
        </span>
      </div>
      <p className="mt-1 mb-4 text-sm font-body text-hoxton-slate">
        Paste your call transcript or upload a file, then let AI summarise the key information
      </p>

      <div className="mb-4 rounded-lg border border-hoxton-turquoise/20 bg-hoxton-turquoise/5 px-4 py-2.5">
        <p className="text-xs font-body text-hoxton-turquoise">
          The AI will write the summary from your perspective as the adviser, addressed to the client.
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="mb-4 inline-flex gap-1 rounded-xl bg-white p-1 shadow-sm border border-gray-100">
        <button
          onClick={() => setMode('paste')}
          className={`rounded-lg px-4 py-2 text-sm font-heading font-medium transition-colors ${
            mode === 'paste'
              ? 'bg-hoxton-turquoise text-white shadow-sm'
              : 'text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep'
          }`}
        >
          Paste Text
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`rounded-lg px-4 py-2 text-sm font-heading font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-hoxton-turquoise text-white shadow-sm'
              : 'text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep'
          }`}
        >
          Upload File
        </button>
      </div>

      {/* Paste Text */}
      {mode === 'paste' && (
        <textarea
          value={draft.transcript}
          onChange={(e) => {
            updateDraft({ transcript: e.target.value })
            setUploadedFile(null)
            clearState()
          }}
          placeholder="Paste your call transcript or meeting notes here. The AI will generate a client-facing summary written from your perspective as their adviser..."
          rows={10}
          className="w-full resize-none rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-3 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
        />
      )}

      {/* Upload File */}
      {mode === 'upload' && (
        <div>
          {!uploadedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all ${
                dragging
                  ? 'border-hoxton-turquoise bg-hoxton-turquoise/5'
                  : 'border-hoxton-grey bg-hoxton-light hover:border-hoxton-turquoise/50 hover:bg-hoxton-turquoise/5'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-hoxton-turquoise" />
                  <p className="text-sm font-heading font-medium text-hoxton-deep">
                    Extracting text...
                  </p>
                </>
              ) : (
                <>
                  <Upload className={`mb-3 h-10 w-10 ${dragging ? 'text-hoxton-turquoise' : 'text-hoxton-slate/50'}`} />
                  <p className="text-sm font-heading font-medium text-hoxton-deep">
                    Drag & drop your transcript file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs font-body text-hoxton-slate/60">
                    Supports .txt, .md, .docx, and .pdf
                  </p>
                  <button
                    type="button"
                    className="mt-4 rounded-lg border border-hoxton-grey bg-white px-4 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    Browse files
                  </button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white">
              {/* File header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-heading font-medium text-hoxton-deep">
                        {uploadedFile}
                      </p>
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-xs font-body text-gray-400">
                      {draft.transcript.length.toLocaleString()} characters extracted
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-heading font-medium text-hoxton-slate transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>

              {/* Text preview */}
              <div className="px-4 py-3">
                <p className="mb-1.5 text-[10px] font-heading font-semibold uppercase tracking-wider text-gray-400">
                  Preview
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-hoxton-light px-3 py-2.5 text-xs font-body leading-relaxed text-hoxton-deep/80">
                  {draft.transcript.slice(0, 500)}
                  {draft.transcript.length > 500 && (
                    <span className="text-hoxton-slate/50">
                      ... ({(draft.transcript.length - 500).toLocaleString()} more characters)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span className="text-sm font-body text-red-700">{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* Summarise + Skip buttons */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSummarise}
            disabled={!draft.transcript.trim() || summarising}
            className="inline-flex items-center gap-2 rounded-lg bg-hoxton-deep px-5 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {summarising ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Summarising with AI... {elapsed > 0 && `(${elapsed}s)`}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Summarise with AI
              </>
            )}
          </button>
          {summarising && (
            <p className="text-xs font-body text-hoxton-slate/70">
              {elapsed < 5
                ? 'Sending transcript to AI...'
                : elapsed < 15
                  ? 'AI is reading and summarising the transcript...'
                  : 'Still working — this can take up to 30 seconds for longer transcripts...'}
            </p>
          )}
        </div>

        <button
          onClick={onSkip}
          disabled={summarising}
          className="text-sm font-heading font-medium text-hoxton-slate hover:text-hoxton-turquoise disabled:opacity-50"
        >
          Skip — I'll fill it in manually →
        </button>
      </div>

      {summarised && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-heading font-medium text-emerald-800">
            Summary generated successfully — context fields have been pre-filled
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm font-body text-red-700">{error}</span>
        </div>
      )}
    </div>
  )
}
