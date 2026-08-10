import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Ban, CheckCheck, ClipboardCheck, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { KontakPeserta } from '@/components/KontakPeserta'
import { Kosong } from '@/components/Kosong'
import { Muncul } from '@/components/Muncul'
import { cn } from '@/lib/utils'
import { inisial, rupiah, sisaWaktu, tanggalJam } from '@/lib/format'
import { useDetik } from '@/lib/use-detik'
import { pesanError } from '@/lib/supabase'
import { useEventTerpilih } from './event-terpilih'
import { PemilihEvent } from './PemilihEvent'
import {
  useBatalkanPO,
  useOrdersAdmin,
  useSetPembayaran,
  useSetujuiPO,
  useTolakPO,
  type AdminOrder,
} from '@/lib/queries/admin'
import type { PaymentMethod } from '@/types/database'

type Saringan = 'pending' | 'approved' | 'rejected' | 'semua'
/** Dua keputusan negatif dengan bentuk dialog yang sama: menolak PO baru vs membatalkan PO fix. */
type Sasaran = { order: AdminOrder; mode: 'tolak' | 'batal' }

const metodeBayar: { nilai: PaymentMethod; label: string }[] = [
  { nilai: 'tunai', label: 'Tunai' },
  { nilai: 'transfer', label: 'Transfer' },
  { nilai: 'qris', label: 'QRIS' },
  { nilai: 'ewallet', label: 'E-wallet' },
]

function KontrolPembayaran({ order }: { order: AdminOrder }) {
  const setBayar = useSetPembayaran()
  const lunas = order.payment_status === 'paid'

  async function ubah(status: 'paid' | 'unpaid', metode?: PaymentMethod) {
    try {
      await setBayar.mutateAsync({ orderId: order.id, status, metode })
    } catch (e) {
      toast.error('Gagal menyimpan pembayaran', { description: pesanError(e) })
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
      <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs">
        <Switch
          checked={lunas}
          disabled={setBayar.isPending}
          onCheckedChange={(v) => void ubah(v ? 'paid' : 'unpaid', v ? 'tunai' : undefined)}
        />
        <span className={lunas ? 'font-medium text-primary' : 'text-muted-foreground'}>
          {lunas ? 'Sudah bayar' : 'Belum bayar'}
        </span>
      </label>

      {lunas && (
        <Select
          value={order.payment_method ?? 'tunai'}
          onValueChange={(v) => void ubah('paid', v as PaymentMethod)}
        >
          <SelectTrigger size="sm" className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {metodeBayar.map((m) => (
              <SelectItem key={m.nilai} value={m.nilai} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

function KartuPO({
  order,
  sekarang,
  onTolak,
  onBatal,
}: {
  order: AdminOrder
  sekarang: number
  onTolak: (o: AdminOrder) => void
  onBatal: (o: AdminOrder) => void
}) {
  const setujui = useSetujuiPO()
  // Hitung mundur milik tenggat pembayaran: slot baru terpakai setelah lunas,
  // jadi yang mendesak adalah menagih, bukan menahan.
  const belumLunas = order.status === 'approved' && order.payment_status === 'unpaid'
  const sisaBayar = belumLunas ? sisaWaktu(order.payment_due_at, sekarang) : null
  const hampirHabis = Boolean(
    sisaBayar && new Date(order.payment_due_at!).getTime() - sekarang < 60 * 60_000,
  )

  async function setuju() {
    try {
      await setujui.mutateAsync(order.id)
      toast.success('PO disetujui', { description: 'Angka keuangan sudah diperbarui.' })
    } catch (e) {
      toast.error('Gagal menyetujui', { description: pesanError(e) })
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-3">
      <div className="flex gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={order.pemesan?.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="text-[10px]">
            {inisial(order.pemesan?.full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {order.pemesan?.full_name ?? 'Pengguna'}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {order.pemesan?.email}
              </p>
            </div>
            <span className="tabular shrink-0 text-sm font-semibold">
              {rupiah(order.total_amount)}
            </span>
          </div>

          <div className="mt-1.5">
            <KontakPeserta
              kelas={order.pemesan?.class_name ?? null}
              phone={order.pemesan?.phone ?? null}
              nama={order.pemesan?.full_name}
            />
          </div>

          <p className="mt-1.5 truncate text-xs">
            <span className="font-medium">{order.menu?.name}</span>
            <span className="text-muted-foreground"> × {order.quantity}</span>
          </p>

          {order.notes && (
            <p className="mt-1 text-[11px] text-muted-foreground">Catatan: {order.notes}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {tanggalJam(order.created_at)}
            </span>
            {sisaBayar && (
              <Badge
                className={cn(
                  'tabular',
                  hampirHabis
                    ? 'bg-destructive/15 text-destructive hover:bg-destructive/15'
                    : 'bg-warning/15 text-warning hover:bg-warning/15',
                )}
              >
                bayar dalam {sisaBayar}
              </Badge>
            )}
            {(order.status === 'rejected' || order.status === 'expired') &&
              order.rejection_reason && (
              <span className="text-[11px] text-destructive">{order.rejection_reason}</span>
            )}
          </div>
        </div>
      </div>

      {order.status === 'pending' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" className="h-9" onClick={setuju} disabled={setujui.isPending}>
            {setujui.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Setujui
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => onTolak(order)}>
            Tolak
          </Button>
        </div>
      )}

      {order.status === 'approved' && (
        <>
          <KontrolPembayaran order={order} />
          {/* PO fix pun masih bisa gugur — bahan habis, pemesan mundur, salah input.
              Slotnya langsung kembali diperebutkan begitu tombol ini ditekan. */}
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-8 w-full gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onBatal(order)}
          >
            <Ban className="size-3.5" />
            Batalkan PO ini
          </Button>
        </>
      )}

      {(order.status === 'expired' || order.status === 'cancelled') && (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 h-8 w-full text-xs"
          onClick={setuju}
          disabled={setujui.isPending}
        >
          {setujui.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Hidupkan &amp; setujui
        </Button>
      )}
    </article>
  )
}

export function ApprovalPage() {
  const { eventId, event } = useEventTerpilih()
  const { data: orders, isPending } = useOrdersAdmin(eventId)
  const tolak = useTolakPO()
  const batal = useBatalkanPO()
  const setujui = useSetujuiPO()

  const [saringan, setSaringan] = useState<Saringan>('pending')
  const [sasaran, setSasaran] = useState<Sasaran | null>(null)
  const [alasan, setAlasan] = useState('')
  const [prosesMassal, setProsesMassal] = useState(false)

  const daftar = useMemo(() => {
    const semua = orders ?? []
    if (saringan === 'semua') return semua
    if (saringan === 'rejected')
      return semua.filter((o) => o.status === 'rejected' || o.status === 'expired' || o.status === 'cancelled')
    return semua.filter((o) => o.status === saringan)
  }, [orders, saringan])

  const menunggu = orders?.filter((o) => o.status === 'pending') ?? []
  const menungguBayar =
    orders?.filter((o) => o.status === 'approved' && o.payment_status === 'unpaid') ?? []
  const sekarang = useDetik(menungguBayar.length > 0)

  async function konfirmasi() {
    if (!sasaran) return
    const membatalkan = sasaran.mode === 'batal'
    try {
      const input = { orderId: sasaran.order.id, alasan: alasan.trim() || undefined }
      if (membatalkan) await batal.mutateAsync(input)
      else await tolak.mutateAsync(input)

      toast.success(membatalkan ? 'PO dibatalkan' : 'PO ditolak', {
        description:
          membatalkan && sasaran.order.payment_status === 'paid'
            ? 'Slotnya kembali tersedia. Jangan lupa kembalikan pembayarannya.'
            : 'Slotnya sudah dikembalikan.',
      })
      setSasaran(null)
      setAlasan('')
    } catch (e) {
      toast.error(membatalkan ? 'Gagal membatalkan' : 'Gagal menolak', { description: pesanError(e) })
    }
  }

  async function setujuiSemua() {
    setProsesMassal(true)
    let berhasil = 0
    const gagal: string[] = []
    // Berurutan, bukan paralel: reserve_slot mengunci baris menu, dan approve
    // mengecek ulang kapasitas — menembak bersamaan hanya memicu antre kunci.
    for (const o of menunggu) {
      try {
        await setujui.mutateAsync(o.id)
        berhasil += 1
      } catch (e) {
        gagal.push(`${o.menu?.name}: ${pesanError(e)}`)
      }
    }
    setProsesMassal(false)
    if (berhasil > 0) toast.success(`${berhasil} PO disetujui`)
    if (gagal.length > 0) toast.error(`${gagal.length} PO gagal`, { description: gagal[0] })
  }

  return (
    <>
      <HeaderHalaman judul="Approval PO" keterangan={event?.name} aksi={<PemilihEvent />} />

      <Tabs value={saringan} onValueChange={(v) => setSaringan(v as Saringan)} className="mb-4">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="text-xs">
            Menunggu{menunggu.length > 0 && ` (${menunggu.length})`}
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">
            Disetujui{menungguBayar.length > 0 && ` (${menungguBayar.length})`}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">
            Batal
          </TabsTrigger>
          <TabsTrigger value="semua" className="text-xs">
            Semua
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {saringan === 'pending' && menunggu.length > 1 && (
        <Button
          variant="outline"
          className="mb-3 h-9 w-full gap-2 text-xs"
          onClick={setujuiSemua}
          disabled={prosesMassal}
        >
          {prosesMassal ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCheck className="size-3.5" />
          )}
          Setujui semua ({menunggu.length})
        </Button>
      )}

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          icon={ClipboardCheck}
          judul={saringan === 'pending' ? 'Tidak ada yang menunggu' : 'Belum ada data'}
          keterangan={
            saringan === 'pending'
              ? 'Semua PO sudah kamu putuskan. Kerja bagus.'
              : 'Coba pilih saringan lain.'
          }
        />
      ) : (
        <div className="space-y-3">
          {daftar.map((o, i) => (
            <Muncul key={o.id} delay={Math.min(i * 0.03, 0.24)}>
              <KartuPO
                order={o}
                sekarang={sekarang}
                onTolak={(order) => setSasaran({ order, mode: 'tolak' })}
                onBatal={(order) => setSasaran({ order, mode: 'batal' })}
              />
            </Muncul>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(sasaran)}
        onOpenChange={(o) => {
          if (!o) {
            setSasaran(null)
            setAlasan('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sasaran?.mode === 'batal' ? 'Batalkan PO yang sudah fix?' : 'Tolak PO ini?'}
            </DialogTitle>
            <DialogDescription>
              Slot {sasaran?.order.menu?.name} akan dikembalikan dan{' '}
              {sasaran?.order.pemesan?.full_name ?? 'pemesan'} mendapat notifikasi.
              {sasaran?.mode === 'batal' && sasaran.order.payment_status === 'paid' && (
                <>
                  {' '}
                  PO ini <strong>sudah dibayar</strong> — pembayarannya perlu kamu kembalikan
                  sendiri di luar aplikasi.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder={
              sasaran?.mode === 'batal'
                ? 'Alasan (opsional) — misal: bahan tidak mencukupi'
                : 'Alasan (opsional) — misal: bahan sudah habis'
            }
            rows={3}
            maxLength={200}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSasaran(null)}>
              Kembali
            </Button>
            <Button
              variant="destructive"
              onClick={konfirmasi}
              disabled={tolak.isPending || batal.isPending}
            >
              {(tolak.isPending || batal.isPending) && <Loader2 className="size-4 animate-spin" />}
              {sasaran?.mode === 'batal' ? 'Batalkan PO' : 'Tolak PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
