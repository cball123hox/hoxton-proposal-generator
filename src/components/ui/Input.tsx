import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-heading font-medium text-hoxton-deep">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full rounded-lg border border-hoxton-grey bg-hoxton-light px-3 py-2 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/60 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
