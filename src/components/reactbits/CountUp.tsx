import { useInView, useMotionValue, useSpring } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

/**
 * React Bits — CountUp, disesuaikan untuk angka rupiah.
 * Perubahan dari versi asli: menerima `format` sendiri sehingga bisa memakai
 * Intl locale id-ID, dan menghormati prefers-reduced-motion (langsung ke nilai akhir).
 */
interface CountUpProps {
  to: number
  from?: number
  delay?: number
  duration?: number
  className?: string
  startWhen?: boolean
  format?: (value: number) => string
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 1.1,
  className = '',
  startWhen = true,
  format,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(from)

  const damping = 20 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)
  const springValue = useSpring(motionValue, { damping, stiffness })

  const isInView = useInView(ref, { once: true, margin: '0px' })

  const formatValue = useCallback(
    (latest: number) =>
      format
        ? format(latest)
        : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(latest),
    [format],
  )

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(from)
  }, [from, formatValue])

  useEffect(() => {
    if (!isInView || !startWhen) return

    if (prefersReducedMotion()) {
      motionValue.jump(to)
      if (ref.current) ref.current.textContent = formatValue(to)
      return
    }

    const timeoutId = setTimeout(() => motionValue.set(to), delay * 1000)
    return () => clearTimeout(timeoutId)
  }, [isInView, startWhen, motionValue, to, delay, formatValue])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) ref.current.textContent = formatValue(latest)
    })
    return () => unsubscribe()
  }, [springValue, formatValue])

  return <span className={className} ref={ref} />
}
