interface HoxtonLogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light'
}

const HEIGHTS = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
}

/**
 * Hoxton Wealth logo — uses the official brand SVG.
 * `variant="light"` renders white logo (for dark backgrounds).
 * `variant="dark"` renders dark teal logo (for light backgrounds).
 */
export function HoxtonLogo({ size = 'md', variant = 'light' }: HoxtonLogoProps) {
  const src = variant === 'light' ? '/hoxton-logo-white.svg' : '/hoxton-logo.svg'

  return (
    <img
      src={src}
      alt="Hoxton Wealth"
      className={`${HEIGHTS[size]} w-auto`}
    />
  )
}
