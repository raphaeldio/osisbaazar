import { Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { KontakPeserta } from '@/components/KontakPeserta'
import { Kosong } from '@/components/Kosong'
import { Muncul } from '@/components/Muncul'
import { inisial, rupiah, sejak } from '@/lib/format'
import { useEventTerpilih } from './event-terpilih'
import { PemilihEvent } from './PemilihEvent'
import { usePeserta } from '@/lib/queries/admin'

export function PesertaPage() {
  const { eventId, event } = useEventTerpilih()
  const { data: peserta, isPending } = usePeserta(eventId)

  const totalBelanja = (peserta ?? []).reduce((t, p) => t + Number(p.total_spent), 0)

  return (
    <>
      <HeaderHalaman
        judul="Peserta PO"
        keterangan={
          peserta && peserta.length > 0
            ? `${peserta.length} orang · ${rupiah(totalBelanja)}`
            : event?.name
        }
        aksi={<PemilihEvent />}
      />

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !peserta || peserta.length === 0 ? (
        <Kosong
          icon={Users}
          judul="Belum ada peserta"
          keterangan="Daftar ini terisi begitu ada yang mengamankan slot."
        />
      ) : (
        <div className="space-y-2">
          {peserta.map((p, i) => (
            <Muncul key={p.user_id} delay={Math.min(i * 0.03, 0.24)}>
              <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">{inisial(p.full_name)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.full_name ?? 'Pengguna'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.email}</p>
                  <div className="mt-1">
                    <KontakPeserta kelas={p.class_name} phone={p.phone} nama={p.full_name} />
                  </div>
                  <div className="tabular mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{p.approved_orders} PO fix</span>
                    <span>·</span>
                    <span>{p.total_items} porsi</span>
                    {p.pending_orders > 0 && (
                      <Badge className="bg-warning/15 text-[10px] text-warning hover:bg-warning/15">
                        {p.pending_orders} menunggu
                      </Badge>
                    )}
                    {Number(p.unpaid_amount) > 0 && (
                      <Badge className="bg-destructive/15 text-[10px] text-destructive hover:bg-destructive/15">
                        Utang {rupiah(p.unpaid_amount)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold">{rupiah(p.total_spent)}</p>
                  <p className="text-[11px] text-muted-foreground">{sejak(p.last_order_at)}</p>
                </div>
              </article>
            </Muncul>
          ))}
        </div>
      )}
    </>
  )
}
