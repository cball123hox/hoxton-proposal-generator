import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, options, className = '', id, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-heading font-medium text-hoxton-deep">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full rounded-lg border border-hoxton-grey bg-hoxton-light px-3 py-2 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
