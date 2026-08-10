import { motion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Animasi masuk standar seluruh aplikasi: fade + geser 8px, 220ms.
 * Sengaja hanya satu gerakan ini agar tampilan terasa tenang dan konsisten.
 * prefers-reduced-motion sudah dimatikan global lewat CSS.
 */
export function Muncul({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
