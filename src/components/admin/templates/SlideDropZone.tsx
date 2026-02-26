import { useState, useRef, useCallback, useEffect } from 'react'
import { CloudUpload, X, Upload, Loader2, RefreshCw } from 'lucide-react'
import { BulkUploadProgress } from './BulkUploadProgress'
import type { UploadProgress } from '../../../lib/upload'

interface FilePreview {
  file: File
  url: string
  name: string
}

interface SlideDropZoneProps {
  existingSlideCount: number
  uploading: boolean
  uploadProgress: UploadProgress | null
  onUpload: (files: File[], replaceAll: boolean) => void
  disabled?: boolean
}

export function SlideDropZone({
  existingSlideCount,
  uploading,
  uploadProgress,
  onUpload,
  disabled,
}: SlideDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<FilePreview[]>([])
  const [sizeError, setSizeError] = useState('')
  const [replaceAll, setReplaceAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  // Clean up object URLs on unmount or when staged files change
  useEffect(() => {
    return () => {
      stagedFiles.forEach((f) => URL.revokeObjectURL(f.url))
    }
  }, [stagedFiles])

  const stageFiles = useCallback((files: File[]) => {
    setSizeError('')
    const imageFiles = files.filter((f) =>
      ['image/png', 'image/jpeg', 'image/jpg'].includes(f.type)
    )
    if (imageFiles.length === 0) return

    const oversized = imageFiles.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setSizeError(`${oversized.length} file(s) exceed the 10MB limit and were skipped`)
      const valid = imageFiles.filter((f) => f.size <= MAX_FILE_SIZE)
      if (valid.length === 0) return
      files = valid
    } else {
      files = imageFiles
    }

    const previews: FilePreview[] = files.map((file, i) => ({
      file,
      url: URL.createObjectURL(file),
      name: `Slide ${i + 1}.PNG`,
    }))

    // Replace any previously staged files
    setStagedFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url))
      return previews
    })
  }, [])

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOver(true)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragOver(false)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    dragCounter.current = 0

    const files = Array.from(e.dataTransfer.files)
    stageFiles(files)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) stageFiles(files)
    e.target.value = ''
  }

  function removeStaged(index: number) {
    setStagedFiles((prev) => {
      const removed = prev[index]
      URL.revokeObjectURL(removed.url)
      const next = prev.filter((_, i) => i !== index)
      // Renumber
      return next.map((f, i) => ({ ...f, name: `Slide ${i + 1}.PNG` }))
    })
  }

  function clearStaged() {
    setStagedFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url))
      return []
    })
  }

  function confirmUpload() {
    const files = stagedFiles.map((f) => f.file)
    onUpload(files, replaceAll)
    setStagedFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url))
      return []
    })
    setReplaceAll(false)
  }

  // While uploading, only show progress
  if (uploading && uploadProgress) {
    return (
      <div className="mb-6">
        <BulkUploadProgress progress={uploadProgress} />
      </div>
    )
  }

  // If files are staged, show preview grid
  if (stagedFiles.length > 0) {
    return (
      <div className="mb-6">
        <div className="rounded-xl border border-hoxton-grey bg-hoxton-light/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-heading font-semibold text-hoxton-deep">
              {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} ready to upload
            </h4>
            <button
              onClick={clearStaged}
              className="text-xs font-heading font-medium text-hoxton-slate hover:text-red-500"
            >
              Clear all
            </button>
          </div>

          {existingSlideCount > 0 && (
            <div className="mb-3 space-y-2">
              <div className={`rounded-lg border px-3 py-2 text-xs font-body ${
                replaceAll
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                {replaceAll
                  ? `This will replace all ${existingSlideCount} existing slides.`
                  : `Adding ${stagedFiles.length} new slide${stagedFiles.length !== 1 ? 's' : ''} after the ${existingSlideCount} existing slides.`
                }
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReplaceAll(!replaceAll)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    replaceAll ? 'bg-amber-500' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                    replaceAll ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`} />
                </button>
                <span className="flex items-center gap-1.5 text-xs font-heading font-medium text-hoxton-slate">
                  <RefreshCw className="h-3 w-3" />
                  Replace existing slides
                </span>
              </label>
            </div>
          )}

          {/* Thumbnail preview grid */}
          <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {stagedFiles.map((preview, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white"
              >
                <div className="aspect-video overflow-hidden bg-gray-50">
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-1.5 py-1">
                  <p className="truncate text-[10px] font-heading font-medium text-hoxton-deep">
                    {preview.name}
                  </p>
                </div>
                <button
                  onClick={() => removeStaged(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Add more + upload buttons */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileInput}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-hoxton-grey bg-white px-3 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
            >
              Add More Files
            </button>
            <button
              onClick={confirmUpload}
              className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
            >
              <Upload className="h-4 w-4" />
              Upload {stagedFiles.length} Slide{stagedFiles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default: drop zone
  return (
    <div className="mb-6">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
          dragOver
            ? 'border-hoxton-turquoise bg-hoxton-turquoise/5'
            : 'border-hoxton-grey bg-hoxton-light/30 hover:border-hoxton-slate/40 hover:bg-hoxton-light/50'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <CloudUpload
          className={`mb-3 h-10 w-10 transition-colors ${
            dragOver ? 'text-hoxton-turquoise' : 'text-hoxton-slate/40'
          }`}
        />
        <p className="text-sm font-heading font-medium text-hoxton-deep">
          {dragOver ? 'Drop your slide images here' : 'Drag & drop your slide images here'}
        </p>
        <p className="mb-4 mt-1 text-xs font-body text-hoxton-slate">
          or
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileInput}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Browse Files
        </button>
        <p className="mt-3 text-[11px] font-body text-hoxton-slate/60">
          PNG, JPG, JPEG &middot; Max 10MB per file &middot; Auto-numbered in selection order
        </p>
      </div>
      {sizeError && (
        <p className="mt-2 text-xs font-body text-red-600">{sizeError}</p>
      )}
    </div>
  )
}
