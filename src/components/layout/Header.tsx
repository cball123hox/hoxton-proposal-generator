interface HeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function Header({ title, description, children }: HeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">{title}</h1>
        {description && (
          <p className="mt-1 text-sm font-body text-hoxton-slate">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}
