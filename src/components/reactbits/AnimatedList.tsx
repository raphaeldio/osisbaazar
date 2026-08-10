import { useRef, type ReactNode } from 'react'
import { motion, useInView } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * React Bits — AnimatedList, disesuaikan.
 * Perubahan dari versi asli: menerima ReactNode (bukan hanya string[]), tanpa
 * lebar tetap 500px, tanpa navigasi keyboard global (versi asli membajak Tab
 * di seluruh halaman), dan animasinya fade + geser 8px alih-alih scale 0.7 —
 * sesuai permintaan "animasi minim dan elegan".
 */

function AnimatedItem({
  children,
  delay = 0,
  index,
}: {
  children: ReactNode
  delay?: number
  index: number
}) {
  const ref = useRef<HTMLLIElement>(null)
  const inView = useInView(ref, { amount: 0.3, once: true })

  return (
    <motion.li
      ref={ref}
      data-index={index}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.22, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.li>
  )
}

interface AnimatedListProps {
  children: ReactNode[]
  className?: string
  /** Jeda antar item, detik. Dibatasi agar daftar panjang tidak terasa lambat. */
  stagger?: number
}

export default function AnimatedList({
  children,
  className,
  stagger = 0.03,
}: AnimatedListProps) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {children.map((child, index) => (
        <AnimatedItem key={index} index={index} delay={Math.min(index * stagger, 0.3)}>
          {child}
        </AnimatedItem>
      ))}
    </ul>
  )
}
