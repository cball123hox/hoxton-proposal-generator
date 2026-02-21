import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let nextId = 0

const ICON_MAP = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const STYLE_MAP = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-hoxton-turquoise/30 bg-hoxton-turquoise/5 text-hoxton-deep',
}

const ICON_STYLE_MAP = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-hoxton-turquoise',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const Icon = ICON_MAP[toast.type]

  useEffect(() => {
    const ms = toast.type === 'error' ? 6000 : 4000
    const timer = setTimeout(() => onDismiss(toast.id), ms)
    return () => clearTimeout(timer)
  }, [toast.id, toast.type, onDismiss])

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-in-right ${STYLE_MAP[toast.type]}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_STYLE_MAP[toast.type]}`} />
      <p className="flex-1 text-sm font-heading font-medium">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg p-0.5 opacity-60 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    setToasts((prev) => [...prev, { id: ++nextId, type, message }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-6 right-6 z-[70] flex flex-col-reverse gap-2">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto w-80">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
