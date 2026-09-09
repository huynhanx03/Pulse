import { cn } from '@/lib/utils/cn'

const APERTURE_INPUT_PATH = 'M5 5H11L14 10L11 14V18L14 22L11 27H5Z'
const APERTURE_OUTPUT_PATH = 'M27 8a3 3 0 0 0-3-3H21L18 10L21 14V18L18 22L21 27H24a3 3 0 0 0 3-3Z'

interface PulseMarkProps {
  className?: string
  size?: number
}

interface PulseLogoProps {
  className?: string
  markSize?: number
}

// Transform Aperture: structured input narrows through execution into observable output.
export const PulseMark = ({ className, size = 24 }: PulseMarkProps) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
    className={cn('shrink-0', className)}
  >
    <path d={APERTURE_INPUT_PATH} fill="currentColor" />
    <path d={APERTURE_OUTPUT_PATH} fill="currentColor" />
  </svg>
)

export const PulseLogo = ({ className, markSize = 24 }: PulseLogoProps) => (
  <span
    role="img"
    aria-label="Pulse"
    className={cn('inline-flex shrink-0 items-center gap-2', className)}
  >
    <PulseMark className="text-brand-mark" size={markSize} />
    <span aria-hidden="true" className="text-[17px] font-bold tracking-[-0.055em] text-ink">
      Pulse
    </span>
  </span>
)
