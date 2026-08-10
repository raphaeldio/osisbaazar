import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Clock, Loader2, ReceiptText, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { GambarMenu } from '@/components/GambarMenu'
import { Kosong } from '@/components/Kosong'
import { Muncul } from '@/components/Muncul'
import { rupiah, sisaWaktu, tanggalJam } from '@/lib/format'
import { useDetik } from '@/lib/use-detik'
import { pesanError } from '@/lib/supabase'
import { useBatalkanPesanan, usePesananSaya } from '@/lib/queries/customer'
import type { MyOrder, OrderStatus } from '@/types/database'

const tampilanStatus: Record<
  OrderStatus,
  { label: string; kelas: string; ikon: typeof Clock }
> = {
  pending: {
    label: 'Menunggu Persetujuan',
    kelas: 'bg-warning/15 text-warning hover:bg-warning/15',
    ikon: Clock,
  },
  approved: {
    label: 'PO Fix',
    kelas: 'bg-primary/15 text-primary hover:bg-primary/15',
    ikon: CheckCircle2,
  },
  rejected: {
    label: 'Ditolak',
    kelas: 'bg-destructive/15 text-destructive hover:bg-destructive/15',
    ikon: XCircle,
  },
  expired: { label: 'Dilepas', kelas: 'bg-muted text-muted-foreground', ikon: XCircle },
  cancelled: { label: 'Dibatalkan', kelas: 'bg-muted text-muted-foreground', ikon: XCircle },
}

function KartuPesanan({
  pesanan,
  sekarang,
  onBatal,
}: {
  pesanan: MyOrder
  sekarang: number
  onBatal: (p: MyOrder) => void
}) {
  const tampil = tampilanStatus[pesanan.status]
  const Ikon = tampil.ikon
  // Hitung mundur sekarang milik tenggat pembayaran, bukan penahanan slot —
  // memesan saja tidak mengunci apa pun.
  const belumLunas = pesanan.status === 'approved' && pesanan.payment_status === 'unpaid'
  const sisaBayar = belumLunas ? sisaWaktu(pesanan.payment_due_at, sekarang) : null
  const tenggatLewat = belumLunas && pesanan.payment_due_at && !sisaBayar

  return (
    <article className="rounded-2xl border border-border bg-card p-3">
      <div className="flex gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-xl">
          <GambarMenu nama={pesanan.menu_name} src={pesanan.image_url} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{pesanan.menu_name}</h3>
              <p className="tabular text-xs text-muted-foreground">
                {pesanan.quantity} porsi · {rupiah(pesanan.unit_sell_price)}
              </p>
            </div>
            <span className="tabular shrink-0 text-sm font-semibold">
              {rupiah(pesanan.total_amount)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={tampil.kelas}>
              <Ikon className="size-3" />
              {tampil.label}
            </Badge>
            {pesanan.status === 'approved' && (
              <Badge
                variant="outline"
                className={
                  pesanan.payment_status === 'paid'
                    ? 'border-primary/40 text-primary'
                    : 'text-muted-foreground'
                }
              >
                {pesanan.payment_status === 'paid'
                  ? `Lunas${pesanan.payment_method ? ` · ${pesanan.payment_method}` : ''}`
                  : 'Belum bayar'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {pesanan.status === 'pending' && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Menunggu keputusan panitia. Slot belum terkunci sampai pembayaranmu
            dikonfirmasi.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={() => onBatal(pesanan)}
          >
            Batalkan
          </Button>
        </div>
      )}

      {belumLunas && (
        <div className="mt-3 rounded-xl bg-warning/10 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-warning">
            {tenggatLewat ? (
              'Batas waktu pembayaran terlewat. Pesanan sedang dilepas.'
            ) : sisaBayar ? (
              <>
                Segera bayar ke panitia — sisa waktu{' '}
                <span className="tabular font-semibold">{sisaBayar}</span>. Slotmu baru
                terkunci setelah pembayaran dikonfirmasi.
              </>
            ) : (
              'Menunggu konfirmasi pembayaran dari panitia.'
            )}
          </p>
        </div>
      )}

      {/* 'cancelled' ikut di sini karena panitia kini bisa membatalkan PO yang sudah fix,
          dan alasannya harus terbaca pemesan — bukan hilang jadi status kosong. */}
      {(pesanan.status === 'rejected' ||
        pesanan.status === 'expired' ||
        pesanan.status === 'cancelled') &&
        pesanan.rejection_reason && (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive">
          {pesanan.rejection_reason}
        </p>
      )}

      {pesanan.notes && (
        <p className="mt-2 text-[11px] text-muted-foreground">Catatan: {pesanan.notes}</p>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">
        Dipesan {tanggalJam(pesanan.created_at)}
      </p>
    </article>
  )
}

export function PesananPage() {
  const { data: pesanan, isPending } = usePesananSaya()
  const batalkan = useBatalkanPesanan()
  const [konfirmasi, setKonfirmasi] = useState<MyOrder | null>(null)

  // PO yang sudah disetujui tapi belum dibayar adalah yang paling mendesak: ada
  // tenggat berjalan dan slotnya belum aman. Karena itu dinaikkan ke paling atas,
  // bukan tenggelam di riwayat.
  const perluBayar =
    pesanan?.filter((p) => p.status === 'approved' && p.payment_status === 'unpaid') ?? []
  const antrian = pesanan?.filter((p) => p.status === 'pending') ?? []
  const riwayat =
    pesanan?.filter(
      (p) => p.status !== 'pending' && !(p.status === 'approved' && p.payment_status === 'unpaid'),
    ) ?? []

  // Yang perlu dihitung mundur sekarang adalah tenggat bayar, bukan penahanan slot.
  const sekarang = useDetik(perluBayar.length > 0)

  async function konfirmasiBatal() {
    if (!konfirmasi) return
    try {
      await batalkan.mutateAsync(konfirmasi.id)
      toast.success('PO dibatalkan', { description: 'Slotnya sudah dikembalikan.' })
    } catch (e) {
      toast.error('Gagal membatalkan', { description: pesanError(e) })
    } finally {
      setKonfirmasi(null)
    }
  }

  return (
    <>
      <HeaderHalaman
        judul="PO Saya"
        keterangan={
          perluBayar.length > 0
            ? `${perluBayar.length} PO menunggu pembayaranmu`
            : antrian.length > 0
              ? `${antrian.length} PO menunggu konfirmasi panitia`
              : 'Riwayat pesananmu'
        }
      />

      {isPending ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : !pesanan || pesanan.length === 0 ? (
        <Kosong
          icon={ReceiptText}
          judul="Belum ada PO"
          keterangan="Buka tab War dan amankan slot menu yang kamu mau."
        />
      ) : (
        <div className="space-y-6">
          {perluBayar.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium tracking-wide text-warning uppercase">
                Segera bayar
              </h2>
              {perluBayar.map((p, i) => (
                <Muncul key={p.id} delay={Math.min(i * 0.03, 0.2)}>
                  <KartuPesanan pesanan={p} sekarang={sekarang} onBatal={setKonfirmasi} />
                </Muncul>
              ))}
            </section>
          )}

          {antrian.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Antrian
              </h2>
              {antrian.map((p, i) => (
                <Muncul key={p.id} delay={Math.min(i * 0.03, 0.2)}>
                  <KartuPesanan pesanan={p} sekarang={sekarang} onBatal={setKonfirmasi} />
                </Muncul>
              ))}
            </section>
          )}

          {riwayat.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Riwayat
              </h2>
              {riwayat.map((p, i) => (
                <Muncul key={p.id} delay={Math.min(i * 0.03, 0.2)}>
                  <KartuPesanan pesanan={p} sekarang={sekarang} onBatal={setKonfirmasi} />
                </Muncul>
              ))}
            </section>
          )}
        </div>
      )}

      <AlertDialog open={Boolean(konfirmasi)} onOpenChange={(o) => !o && setKonfirmasi(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan PO ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Slot {konfirmasi?.menu_name} akan dilepas dan bisa direbut orang lain. Kamu masih
              boleh memesan lagi selama slotnya tersisa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tidak jadi</AlertDialogCancel>
            <AlertDialogAction onClick={konfirmasiBatal} disabled={batalkan.isPending}>
              {batalkan.isPending && <Loader2 className="size-4 animate-spin" />}
              Ya, batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
