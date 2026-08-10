import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function Kosong({
  icon: Icon,
  judul,
  keterangan,
  aksi,
}: {
  icon: LucideIcon
  judul: string
  keterangan?: string
  aksi?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{judul}</p>
        {keterangan && (
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
            {keterangan}
          </p>
        )}
      </div>
      {aksi}
    </div>
  )
}
