import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Kartu angka kecil yang dipakai berulang di dashboard admin. */
export function KartuStat({
  label,
  nilai,
  catatan,
  nada = 'netral',
  className,
}: {
  label: string
  nilai: ReactNode
  catatan?: ReactNode
  nada?: 'netral' | 'positif' | 'negatif'
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-3.5', className)}>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'tabular mt-1 truncate text-lg font-semibold',
          nada === 'positif' && 'text-primary',
          nada === 'negatif' && 'text-destructive',
        )}
      >
        {nilai}
      </p>
      {catatan && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{catatan}</p>}
    </div>
  )
}
