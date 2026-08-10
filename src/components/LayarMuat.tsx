import { Loader2 } from 'lucide-react'

export function LayarMuat({ pesan = 'Memuat…' }: { pesan?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{pesan}</p>
    </div>
  )
}
