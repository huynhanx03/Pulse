import { useEffect, useRef, useState } from 'react'

/** Collapses secondary tabs only when their own container is genuinely constrained. */
export const useCompactTabs = (minimumInlineWidth: number) => {
  const ref = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const update = () => {
      const width = element.getBoundingClientRect().width
      if (width > 0) setCompact(width < minimumInlineWidth)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => observer.disconnect()
  }, [minimumInlineWidth])

  return { ref, compact }
}
