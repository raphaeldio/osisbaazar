import { Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { Kosong } from '@/components/Kosong'
import { Muncul } from '@/components/Muncul'
import { cn } from '@/lib/utils'
import { inisial, rupiah } from '@/lib/format'
import { useLeaderboard } from '@/lib/queries/customer'
import { useAuth } from '@/features/auth/AuthProvider'
import type { LeaderboardRow } from '@/types/database'

const medali = ['bg-warning/20 text-warning', 'bg-muted-foreground/20 text-foreground', 'bg-chart-3/20 text-chart-3']

function Podium({ baris, saya }: { baris: LeaderboardRow[]; saya: string | undefined }) {
  // Urutan tampil 2 – 1 – 3 supaya juara berada di tengah dan paling tinggi.
  const urutanTampil = [baris[1], baris[0], baris[2]].filter(Boolean)
  const tinggi: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' }

  return (
    <div className="flex items-end justify-center gap-3 pt-2 pb-6">
      {urutanTampil.map((b) => (
        <div key={b.user_id} className="flex w-[30%] flex-col items-center gap-2">
          <Avatar
            className={cn(
              'size-12 border-2',
              b.rank === 1 ? 'size-16 border-warning' : 'border-border',
            )}
          >
            <AvatarImage src={b.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="text-xs">{inisial(b.full_name)}</AvatarFallback>
          </Avatar>
          <p className="w-full truncate text-center text-xs font-medium">
            {b.full_name ?? 'Anonim'}
            {b.user_id === saya && <span className="text-primary"> (kamu)</span>}
          </p>
          <p className="tabular text-[11px] text-muted-foreground">{rupiah(b.total_spent)}</p>
          <div
            className={cn(
              'flex w-full items-start justify-center rounded-t-xl border border-b-0 border-border bg-card pt-2',
              tinggi[b.rank] ?? 'h-12',
            )}
          >
            <span className="text-sm font-semibold text-muted-foreground">{b.rank}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function BarisPeringkat({ baris, saya }: { baris: LeaderboardRow; saya: string | undefined }) {
  const iniSaya = baris.user_id === saya
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border p-2.5',
        iniSaya ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <span
        className={cn(
          'tabular flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
          baris.rank <= 3 ? medali[baris.rank - 1] : 'bg-muted text-muted-foreground',
        )}
      >
        {baris.rank}
      </span>
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={baris.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="text-[10px]">{inisial(baris.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {baris.full_name ?? 'Anonim'}
          {iniSaya && <span className="text-primary"> (kamu)</span>}
        </p>
        <p className="tabular text-[11px] text-muted-foreground">
          {baris.order_count} PO · {baris.total_items} porsi
        </p>
      </div>
      <span className="tabular shrink-0 text-sm font-semibold">{rupiah(baris.total_spent)}</span>
    </div>
  )
}

export function PeringkatPage() {
  const { session } = useAuth()
  const { data: papan, isPending } = useLeaderboard()
  const saya = session?.user.id

  const barisSaya = papan?.find((b) => b.user_id === saya)
  const tampilDiDaftar = papan?.slice(3) ?? []
  // Kalau posisi kita di luar daftar yang terlihat, tempelkan di bawah layar.
  const perluDitempel = Boolean(barisSaya) && !tampilDiDaftar.some((b) => b.user_id === saya)

  return (
    <>
      <HeaderHalaman judul="Peringkat" keterangan="Berdasarkan total belanja PO yang disetujui" />

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-2xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !papan || papan.length === 0 ? (
        <Kosong
          icon={Trophy}
          judul="Papan peringkat masih kosong"
          keterangan="Peringkat muncul setelah ada PO yang disetujui panitia."
        />
      ) : (
        <>
          <Muncul>
            <Podium baris={papan} saya={saya} />
          </Muncul>

          <div className="space-y-2">
            {tampilDiDaftar.map((b, i) => (
              <Muncul key={b.user_id} delay={Math.min(i * 0.03, 0.24)}>
                <BarisPeringkat baris={b} saya={saya} />
              </Muncul>
            ))}
          </div>

          {perluDitempel && barisSaya && barisSaya.rank > 3 && (
            <div className="sticky bottom-2 z-20 mt-3">
              <BarisPeringkat baris={barisSaya} saya={saya} />
            </div>
          )}
        </>
      )}
    </>
  )
}
