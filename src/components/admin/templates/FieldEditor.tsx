import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Plus, Trash2, Save, Loader2, Type, AlignLeft, Table, CheckCircle2, AlertCircle } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import type { EditableFieldDef } from '../../../types'

interface SaveResult {
  success: boolean
  error?: string
}

interface FieldEditorProps {
  slideImageUrl: string
  slideLabel: string
  initialFields: EditableFieldDef[]
  onSave: (fields: EditableFieldDef[]) => Promise<SaveResult>
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

type InteractionMode = 'idle' | 'drawing' | 'moving' | 'resizing'

export function FieldEditor({
  slideImageUrl,
  slideLabel,
  initialFields,
  onSave,
  onClose,
}: FieldEditorProps) {
  // Ensure initialFields is always a valid array (guard against unexpected formats from DB)
  const safeInitialFields = Array.isArray(initialFields) ? initialFields : []

  const [fields, setFields] = useState<EditableFieldDef[]>(safeInitialFields)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Interaction state
  const [mode, setMode] = useState<InteractionMode>('idle')
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    fieldId: string
    startMouse: { x: number; y: number }
    startField: { x: number; y: number; width: number; height: number }
  } | null>(null)

  // Sync initialFields prop → state whenever it changes (handles reopen with fresh DB data)
  useEffect(() => {
    const safe = Array.isArray(initialFields) ? initialFields : []
    setFields(safe)
  }, [initialFields])

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null

  const getRelativePos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }, [])

  // ── Drawing new fields ──

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-field-overlay]')) return
    const pos = getRelativePos(e)
    setMode('drawing')
    setDrawStart(pos)
    setDrawCurrent(pos)
    setSelectedFieldId(null)
  }

  // ── Moving existing fields ──

  function handleFieldMoveStart(e: React.MouseEvent, fieldId: string) {
    e.stopPropagation()
    e.preventDefault()
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return
    setSelectedFieldId(fieldId)
    setMode('moving')
    dragRef.current = {
      fieldId,
      startMouse: getRelativePos(e),
      startField: { x: field.x, y: field.y, width: field.width, height: field.height },
    }
  }

  // ── Resizing existing fields ──

  function handleFieldResizeStart(e: React.MouseEvent, fieldId: string) {
    e.stopPropagation()
    e.preventDefault()
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return
    setSelectedFieldId(fieldId)
    setMode('resizing')
    dragRef.current = {
      fieldId,
      startMouse: getRelativePos(e),
      startField: { x: field.x, y: field.y, width: field.width, height: field.height },
    }
  }

  // ── Unified mouse move ──

  function handleCanvasMouseMove(e: React.MouseEvent) {
    const pos = getRelativePos(e)

    if (mode === 'drawing') {
      setDrawCurrent(pos)
      return
    }

    if ((mode === 'moving' || mode === 'resizing') && dragRef.current) {
      const { fieldId, startMouse, startField } = dragRef.current
      const dx = pos.x - startMouse.x
      const dy = pos.y - startMouse.y

      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f
          if (mode === 'moving') {
            return {
              ...f,
              x: Math.round(Math.max(0, Math.min(100 - startField.width, startField.x + dx)) * 10) / 10,
              y: Math.round(Math.max(0, Math.min(100 - startField.height, startField.y + dy)) * 10) / 10,
            }
          }
          // resizing
          const newW = Math.max(2, startField.width + dx)
          const newH = Math.max(2, startField.height + dy)
          return {
            ...f,
            width: Math.round(Math.min(100 - startField.x, newW) * 10) / 10,
            height: Math.round(Math.min(100 - startField.y, newH) * 10) / 10,
          }
        })
      )
    }
  }

  // ── Unified mouse up ──

  function handleCanvasMouseUp() {
    if (mode === 'drawing' && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x)
      const y = Math.min(drawStart.y, drawCurrent.y)
      const width = Math.abs(drawCurrent.x - drawStart.x)
      const height = Math.abs(drawCurrent.y - drawStart.y)

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
    }

    setMode('idle')
    setDrawStart(null)
    setDrawCurrent(null)
    dragRef.current = null
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
    setSaveStatus(null)
    const result = await onSave(fields)
    setSaving(false)
    if (result.success) {
      setSaveStatus({ type: 'success', message: `${fields.length} field${fields.length !== 1 ? 's' : ''} saved successfully` })
      setTimeout(() => onClose(), 800)
    } else {
      setSaveStatus({ type: 'error', message: result.error || 'Failed to save fields' })
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
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

  const drawRect = mode === 'drawing' && drawStart && drawCurrent
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
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 960,
                  margin: '0 auto',
                  cursor: 'crosshair',
                  userSelect: 'none',
                  borderRadius: 8,
                  border: '2px solid #e5e7eb',
                  background: '#f3f4f6',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  if (mode !== 'idle') handleCanvasMouseUp()
                }}
              >
                <img
                  src={slideImageUrl}
                  alt={slideLabel}
                  draggable={false}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />

                {/* Existing field overlays */}
                {fields.map((field, i) => {
                  const isSelected = field.id === selectedFieldId
                  return (
                    <div
                      key={field.id}
                      data-field-overlay="true"
                      style={{
                        position: 'absolute',
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                        border: isSelected ? '2px solid #033839' : '2px solid #1AB0C4',
                        backgroundColor: isSelected ? 'rgba(3, 56, 57, 0.2)' : 'rgba(26, 176, 196, 0.15)',
                        zIndex: isSelected ? 20 : 10,
                        cursor: 'move',
                        boxSizing: 'border-box',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFieldId(field.id)
                      }}
                      onMouseDown={(e) => handleFieldMoveStart(e, field.id)}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          padding: '1px 5px',
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: '16px',
                          color: '#fff',
                          backgroundColor: isSelected ? '#033839' : '#1AB0C4',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {field.label}
                      </span>
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 10,
                            height: 10,
                            cursor: 'se-resize',
                            backgroundColor: '#033839',
                          }}
                          onMouseDown={(e) => handleFieldResizeStart(e, field.id)}
                        />
                      )}
                    </div>
                  )
                })}

                {/* Drawing rectangle */}
                {drawRect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${drawRect.x}%`,
                      top: `${drawRect.y}%`,
                      width: `${drawRect.width}%`,
                      height: `${drawRect.height}%`,
                      border: '2px dashed #1AB0C4',
                      backgroundColor: 'rgba(26, 176, 196, 0.1)',
                      pointerEvents: 'none',
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
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            {saveStatus ? (
              <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-heading font-medium ${
                saveStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {saveStatus.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {saveStatus.message}
              </div>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep disabled:opacity-50"
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
