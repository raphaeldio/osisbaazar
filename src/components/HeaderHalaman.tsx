import type { ReactNode } from 'react'

export function HeaderHalaman({
  judul,
  keterangan,
  aksi,
}: {
  judul: string
  keterangan?: string
  aksi?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border/60 bg-background/85 px-4 pt-safe backdrop-blur-lg">
      <div className="flex items-start justify-between gap-3 py-3.5">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{judul}</h1>
          {keterangan && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{keterangan}</p>
          )}
        </div>
        {aksi && <div className="flex shrink-0 items-center gap-2">{aksi}</div>}
      </div>
    </header>
  )
}
