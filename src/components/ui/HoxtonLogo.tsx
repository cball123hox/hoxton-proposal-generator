interface HoxtonLogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light'
}

const SIZES = {
  sm: { icon: 28, text: 'text-lg', gap: 'gap-2' },
  md: { icon: 36, text: 'text-2xl', gap: 'gap-2.5' },
  lg: { icon: 48, text: 'text-3xl', gap: 'gap-3' },
}

/**
 * Hoxton Wealth logo — stylised double-chevron "W" mark + wordmark.
 * `variant="light"` renders white text (for dark backgrounds).
 * `variant="dark"` renders dark teal text (for light backgrounds).
 */
export function HoxtonLogo({ size = 'md', variant = 'light' }: HoxtonLogoProps) {
  const s = SIZES[size]
  const textColor = variant === 'light' ? 'text-white' : 'text-hoxton-deep'
  const accentColor = variant === 'light' ? 'text-hoxton-mint' : 'text-hoxton-turquoise'

  return (
    <div className={`inline-flex items-center ${s.gap}`}>
      {/* Stylised "W" mark — two overlapping chevrons */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="12" fill="#033839" />
        <path
          d="M10 14L17 34L24 20L31 34L38 14"
          stroke="#1AB0C4"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 14L20 30L24 22L28 30L34 14"
          stroke="#B8F4EF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
      </svg>

      {/* Wordmark */}
      <span className={`${s.text} font-heading font-semibold tracking-tight ${textColor}`}>
        Hoxton<span className={`font-normal ${accentColor}`}>Wealth</span>
      </span>
    </div>
  )
}
