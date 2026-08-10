import React, { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * React Bits — SpotlightCard, disesuaikan.
 * Perubahan dari versi asli: memakai token tema (bukan neutral-800/900 hardcoded),
 * padding diserahkan ke pemanggil, dan sorotan dimatikan pada perangkat sentuh
 * (tidak ada kursor, jadi efeknya hanya jadi beban render).
 */
interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string
  spotlightColor?: string
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className,
  spotlightColor = 'color-mix(in oklab, var(--primary) 22%, transparent)',
}) => {
  const divRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current) return
    const rect = divRef.current.getBoundingClientRect()
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

export default SpotlightCard
