import { useState } from 'react'

interface SlideThumbProps {
  src: string
  alt: string
  className?: string
  onClick?: () => void
}

export function SlideThumb({ src, alt, className = '', onClick }: SlideThumbProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-hoxton-deep ${className} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <span className="px-1 text-center text-[8px] font-heading font-medium leading-tight text-white/70">
          {alt}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`object-cover ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  )
}
