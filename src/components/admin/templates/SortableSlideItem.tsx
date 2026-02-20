import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Image, Trash2, Loader2, Pencil } from 'lucide-react'
import { SlideThumb } from './SlideThumb'

interface SortableSlideItemProps {
  id: string
  slideNumber: number
  index: number
  total: number
  imageSrc: string
  onReplace: (file: File) => void
  onDelete: () => void
  onEditFields?: () => void
  fieldCount?: number
  isReplacing?: boolean
}

export function SortableSlideItem({
  id,
  slideNumber,
  index,
  total,
  imageSrc,
  onReplace,
  onDelete,
  onEditFields,
  fieldCount,
  isReplacing,
}: SortableSlideItemProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onReplace(file)
      e.target.value = ''
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
        isDragging
          ? 'z-10 border-hoxton-turquoise bg-white shadow-lg'
          : 'border-gray-100 bg-hoxton-light/30'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab rounded p-0.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Thumbnail */}
      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
        <SlideThumb
          src={imageSrc}
          alt={`Slide ${slideNumber}`}
          className="h-full w-full"
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-heading font-medium text-hoxton-deep">
          Slide {slideNumber}
        </p>
        <p className="text-xs font-body text-gray-400">
          Position {index + 1} of {total}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {onEditFields && (
          <button
            onClick={onEditFields}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-heading font-medium transition-colors ${
              fieldCount && fieldCount > 0
                ? 'border-hoxton-turquoise/30 bg-hoxton-turquoise/5 text-hoxton-turquoise hover:bg-hoxton-turquoise/10'
                : 'border-gray-200 bg-white text-hoxton-slate hover:bg-gray-50'
            }`}
          >
            <Pencil className="h-3 w-3" />
            {fieldCount && fieldCount > 0 ? `${fieldCount} Fields` : 'Fields'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isReplacing}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-heading font-medium text-hoxton-slate transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {isReplacing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Image className="h-3 w-3" />
          )}
          Replace
        </button>
        <button
          onClick={onDelete}
          className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
