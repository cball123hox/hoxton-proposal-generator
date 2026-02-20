import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Plus, Trash2, Save, Loader2, Type, AlignLeft, Table } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import type { EditableFieldDef } from '../../../types'

interface FieldEditorProps {
  slideImageUrl: string
  slideLabel: string
  initialFields: EditableFieldDef[]
  onSave: (fields: EditableFieldDef[]) => Promise<void>
  onClose: () => void
}

const FIELD_COLORS = [
  '#1AB0C4', // turquoise
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EF4444', // red
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6', // teal
]

const AUTO_FILL_OPTIONS = [
  { value: '', label: 'None (manual)' },
  { value: 'client_name', label: 'Client Name' },
  { value: 'advisor_name', label: 'Advisor Name' },
  { value: 'date', label: "Today's Date" },
  { value: 'hxt_reference', label: 'HXT Reference' },
  { value: 'region_name', label: 'Region Name' },
]

function generateId() {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function FieldEditor({
  slideImageUrl,
  slideLabel,
  initialFields,
  onSave,
  onClose,
}: FieldEditorProps) {
  const [fields, setFields] = useState<EditableFieldDef[]>(initialFields)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }, [])

  function handleCanvasMouseDown(e: React.MouseEvent) {
    // Only start drawing if clicking on the canvas background (not on an existing field)
    if ((e.target as HTMLElement).dataset.fieldOverlay) return
    const pos = getRelativePos(e)
    setDrawing(true)
    setDrawStart(pos)
    setDrawCurrent(pos)
    setSelectedFieldId(null)
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!drawing) return
    setDrawCurrent(getRelativePos(e))
  }

  function handleCanvasMouseUp() {
    if (!drawing || !drawStart || !drawCurrent) {
      setDrawing(false)
      return
    }

    const x = Math.min(drawStart.x, drawCurrent.x)
    const y = Math.min(drawStart.y, drawCurrent.y)
    const width = Math.abs(drawCurrent.x - drawStart.x)
    const height = Math.abs(drawCurrent.y - drawStart.y)

    // Minimum size threshold (2% of canvas)
    if (width > 2 && height > 2) {
      const newField: EditableFieldDef = {
        id: generateId(),
        name: `field_${fields.length + 1}`,
        label: `Field ${fields.length + 1}`,
        type: 'text',
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        fontSize: 16,
        fontFamily: 'body',
        fontWeight: 'normal',
        color: '#033839',
        textAlign: 'left',
      }
      setFields((prev) => [...prev, newField])
      setSelectedFieldId(newField.id)
    }

    setDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)
  }

  function updateField(id: string, updates: Partial<EditableFieldDef>) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
  }

  function deleteField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id))
    if (selectedFieldId === id) setSelectedFieldId(null)
  }

  async function handleSave() {
    setSaving(true)
    await onSave(fields)
    setSaving(false)
    onClose()
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete if not focused on an input
        if (
          selectedFieldId &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLSelectElement) &&
          !(e.target instanceof HTMLTextAreaElement)
        ) {
          deleteField(selectedFieldId)
        }
      }
      if (e.key === 'Escape') {
        setSelectedFieldId(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedFieldId])

  const drawRect = drawing && drawStart && drawCurrent
    ? {
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        width: Math.abs(drawCurrent.x - drawStart.x),
        height: Math.abs(drawCurrent.y - drawStart.y),
      }
    : null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div
          className="relative flex max-h-[95vh] w-full max-w-[1400px] flex-col rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h3 className="font-heading font-semibold text-hoxton-deep">
                Edit Fields — {slideLabel}
              </h3>
              <p className="text-sm font-body text-gray-400">
                Click and drag on the slide to draw editable regions. {fields.length} field{fields.length !== 1 ? 's' : ''} defined.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body — split panel */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left — Slide canvas */}
            <div className="flex-1 overflow-auto p-6">
              <div
                ref={canvasRef}
                className="relative mx-auto cursor-crosshair select-none overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-100"
                style={{ maxWidth: 960, aspectRatio: '16/9' }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  if (drawing) handleCanvasMouseUp()
                }}
              >
                <img
                  src={slideImageUrl}
                  alt={slideLabel}
                  className="h-full w-full object-contain"
                  draggable={false}
                />

                {/* Existing field overlays */}
                {fields.map((field, i) => {
                  const color = FIELD_COLORS[i % FIELD_COLORS.length]
                  const isSelected = field.id === selectedFieldId
                  return (
                    <div
                      key={field.id}
                      data-field-overlay="true"
                      className="absolute cursor-pointer"
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                        border: `2px solid ${color}`,
                        backgroundColor: `${color}20`,
                        outline: isSelected ? `2px solid ${color}` : 'none',
                        outlineOffset: 2,
                        zIndex: isSelected ? 20 : 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFieldId(field.id)
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <span
                        className="absolute left-0 top-0 px-1 py-0.5 text-[10px] font-heading font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {field.label}
                      </span>
                    </div>
                  )
                })}

                {/* Drawing rectangle */}
                {drawRect && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-hoxton-turquoise"
                    style={{
                      left: `${drawRect.x}%`,
                      top: `${drawRect.y}%`,
                      width: `${drawRect.width}%`,
                      height: `${drawRect.height}%`,
                      backgroundColor: 'rgba(26, 176, 196, 0.1)',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Right — Field properties panel */}
            <div className="w-[340px] shrink-0 overflow-y-auto border-l border-gray-100 bg-gray-50/50">
              {selectedField ? (
                <FieldProperties
                  field={selectedField}
                  color={FIELD_COLORS[fields.findIndex((f) => f.id === selectedField.id) % FIELD_COLORS.length]}
                  onUpdate={(updates) => updateField(selectedField.id, updates)}
                  onDelete={() => deleteField(selectedField.id)}
                />
              ) : (
                <div className="p-6">
                  <h4 className="mb-4 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Fields ({fields.length})
                  </h4>
                  {fields.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
                      <Plus className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                      <p className="text-sm font-heading font-medium text-gray-400">
                        No fields yet
                      </p>
                      <p className="mt-1 text-xs font-body text-gray-400">
                        Draw a rectangle on the slide to create an editable field
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {fields.map((field, i) => (
                        <button
                          key={field.id}
                          onClick={() => setSelectedFieldId(field.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white"
                        >
                          <div
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: FIELD_COLORS[i % FIELD_COLORS.length] }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-heading font-medium text-hoxton-deep">
                              {field.label}
                            </p>
                            <p className="text-xs font-body text-gray-400">
                              {field.type} {field.autoFill ? `(${field.autoFill})` : ''}
                            </p>
                          </div>
                          {field.type === 'text' && <Type className="h-3 w-3 text-gray-400" />}
                          {field.type === 'textarea' && <AlignLeft className="h-3 w-3 text-gray-400" />}
                          {field.type === 'table' && <Table className="h-3 w-3 text-gray-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              Save Fields
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

/* ── Field Properties Panel ── */

function FieldProperties({
  field,
  color,
  onUpdate,
  onDelete,
}: {
  field: EditableFieldDef
  color: string
  onUpdate: (updates: Partial<EditableFieldDef>) => void
  onDelete: () => void
}) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
          <h4 className="text-sm font-heading font-semibold text-hoxton-deep">
            Field Properties
          </h4>
        </div>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Delete field"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Label */}
        <div>
          <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
            Label
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
          />
        </div>

        {/* Name (slug) */}
        <div>
          <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
            Field Name <span className="text-gray-400">(slug)</span>
          </label>
          <input
            type="text"
            value={field.name}
            onChange={(e) =>
              onUpdate({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
          />
        </div>

        {/* Type */}
        <div>
          <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
            Type
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['text', 'textarea', 'table'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onUpdate({ type: t })}
                className={`rounded-lg px-3 py-2 text-xs font-heading font-medium transition-colors ${
                  field.type === t
                    ? 'bg-hoxton-turquoise text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t === 'text' && <Type className="mx-auto mb-0.5 h-3.5 w-3.5" />}
                {t === 'textarea' && <AlignLeft className="mx-auto mb-0.5 h-3.5 w-3.5" />}
                {t === 'table' && <Table className="mx-auto mb-0.5 h-3.5 w-3.5" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-fill */}
        <div>
          <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
            Auto-fill Source
          </label>
          <select
            value={field.autoFill || ''}
            onChange={(e) => onUpdate({ autoFill: e.target.value || undefined })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
          >
            {AUTO_FILL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Font */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
              Font
            </label>
            <select
              value={field.fontFamily}
              onChange={(e) => onUpdate({ fontFamily: e.target.value as 'heading' | 'body' })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
            >
              <option value="heading">FT Calhern</option>
              <option value="body">Sentient</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
              Size (px)
            </label>
            <input
              type="number"
              min={8}
              max={72}
              value={field.fontSize}
              onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 16 })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
            />
          </div>
        </div>

        {/* Font Weight + Color */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
              Weight
            </label>
            <select
              value={field.fontWeight}
              onChange={(e) =>
                onUpdate({ fontWeight: e.target.value as EditableFieldDef['fontWeight'] })
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
            >
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="semibold">Semibold</option>
              <option value="bold">Bold</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={field.color}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-gray-200"
              />
              <input
                type="text"
                value={field.color}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 font-mono text-xs text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              />
            </div>
          </div>
        </div>

        {/* Text Align */}
        <div>
          <label className="mb-1 block text-xs font-heading font-medium text-gray-500">
            Alignment
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => onUpdate({ textAlign: align })}
                className={`rounded-lg px-3 py-2 text-xs font-heading font-medium capitalize transition-colors ${
                  field.textAlign === align
                    ? 'bg-hoxton-turquoise text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-100'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>

        {/* Position readout */}
        <div className="rounded-lg bg-gray-100 px-3 py-2">
          <p className="text-[10px] font-heading font-medium uppercase tracking-wider text-gray-400">
            Position
          </p>
          <p className="font-mono text-xs text-gray-600">
            x: {field.x.toFixed(1)}% y: {field.y.toFixed(1)}% w: {field.width.toFixed(1)}% h: {field.height.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  )
}
