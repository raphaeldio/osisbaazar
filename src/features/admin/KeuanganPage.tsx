import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, Loader2, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { KartuStat } from '@/components/KartuStat'
import { Kosong } from '@/components/Kosong'
import { Muncul } from '@/components/Muncul'
import { angka, persen, rupiah, rupiahRingkas, tanggal } from '@/lib/format'
import { pesanError } from '@/lib/supabase'
import { labelKategori } from '@/lib/export/data'
import { useEventTerpilih } from './event-terpilih'
import { PemilihEvent } from './PemilihEvent'
import {
  useBiaya,
  useHapusBiaya,
  useKeuangan,
  useKeuanganHarian,
  useOrdersAdmin,
  usePerformaMenu,
  usePeserta,
  useSimpanBiaya,
} from '@/lib/queries/admin'
import type { ExpenseCategory } from '@/types/database'

const skemaBiaya = z.object({
  label: z.string().trim().min(1, 'Keterangan wajib diisi').max(80),
  category: z.enum(['transport', 'kemasan', 'sewa', 'promosi', 'peralatan', 'lainnya']),
  // String, bukan number: `FormField` shadcn tidak meneruskan generic transform Zod.
  amount: z
    .string()
    .trim()
    .min(1, 'Jumlah wajib diisi')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Jumlah harus lebih dari 0'),
  incurred_at: z.string().min(1, 'Tanggal wajib diisi'),
})
type FormBiaya = z.infer<typeof skemaBiaya>

function DialogBiaya({ eventId }: { eventId: string }) {
  const [buka, setBuka] = useState(false)
  const simpan = useSimpanBiaya()

  const form = useForm<FormBiaya>({
    resolver: zodResolver(skemaBiaya),
    defaultValues: {
      label: '',
      category: 'lainnya',
      amount: '',
      incurred_at: new Date().toISOString().slice(0, 10),
    },
  })

  async function kirim(nilai: FormBiaya) {
    try {
      await simpan.mutateAsync({
        event_id: eventId,
        label: nilai.label,
        category: nilai.category,
        amount: Number(nilai.amount),
        incurred_at: nilai.incurred_at,
      })
      toast.success('Biaya dicatat')
      form.reset()
      setBuka(false)
    } catch (e) {
      toast.error('Gagal menyimpan biaya', { description: pesanError(e) })
    }
  }

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <Plus className="size-3.5" />
          Catat biaya
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat biaya operasional</DialogTitle>
          <DialogDescription>
            Biaya di luar modal produk — transport, kemasan, sewa stand. Ini yang membedakan laba
            kotor dengan laba bersih.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(kirim)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl>
                    <Input placeholder="Sewa meja & kursi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="numeric" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="incurred_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(labelKategori) as ExpenseCategory[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {labelKategori[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={simpan.isPending}>
              {simpan.isPending && <Loader2 className="size-4 animate-spin" />}
              Simpan biaya
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function KeuanganPage() {
  const { eventId, event } = useEventTerpilih()
  const { data: keuangan, isPending } = useKeuangan(eventId)
  const { data: performa } = usePerformaMenu(eventId)
  const { data: harian } = useKeuanganHarian(eventId)
  const { data: biaya } = useBiaya(eventId)
  const { data: peserta } = usePeserta(eventId)
  const { data: orders } = useOrdersAdmin(eventId)
  const hapusBiaya = useHapusBiaya()

  const [mengekspor, setMengekspor] = useState<'pdf' | 'excel' | null>(null)

  // Berapa persen peserta yang memesan lebih dari sekali — indikator kepuasan sederhana.
  const repeatRate = useMemo(() => {
    const daftar = peserta ?? []
    if (daftar.length === 0) return 0
    return (daftar.filter((p) => p.approved_orders > 1).length / daftar.length) * 100
  }, [peserta])

  const dataChart = (harian ?? []).map((h) => ({
    hari: tanggal(h.day),
    omzet: Number(h.revenue),
    laba: Number(h.gross_profit),
  }))

  const chartConfig = {
    omzet: { label: 'Omzet', color: 'var(--chart-2)' },
    laba: { label: 'Laba kotor', color: 'var(--chart-4)' },
  } satisfies ChartConfig

  // Progres menuju titik impas biaya operasional.
  const progresBep =
    keuangan && Number(keuangan.operating_expenses) > 0
      ? Math.min((Number(keuangan.gross_profit) / Number(keuangan.operating_expenses)) * 100, 100)
      : null

  function paketData() {
    if (!event || !keuangan) return null
    return {
      event,
      keuangan,
      performa: performa ?? [],
      biaya: biaya ?? [],
      peserta: peserta ?? [],
      orders: orders ?? [],
    }
  }

  // jsPDF & ExcelJS berat (±1 MB gabungan). Dimuat hanya saat tombol ditekan
  // supaya halaman customer maupun dashboard tidak ikut menanggung ukurannya.
  async function unduhPdf() {
    const data = paketData()
    if (!data) return
    setMengekspor('pdf')
    try {
      const { exportPdf } = await import('@/lib/export/pdf')
      exportPdf(data)
      toast.success('PDF diunduh')
    } catch (e) {
      toast.error('Gagal membuat PDF', { description: pesanError(e) })
    } finally {
      setMengekspor(null)
    }
  }

  async function unduhExcel() {
    const data = paketData()
    if (!data) return
    setMengekspor('excel')
    try {
      const { exportExcel } = await import('@/lib/export/excel')
      await exportExcel(data)
      toast.success('Excel diunduh')
    } catch (e) {
      toast.error('Gagal membuat Excel', { description: pesanError(e) })
    } finally {
      setMengekspor(null)
    }
  }

  if (isPending) {
    return (
      <>
        <HeaderHalaman judul="Keuangan" />
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </>
    )
  }

  if (!keuangan) {
    return (
      <>
        <HeaderHalaman judul="Keuangan" aksi={<PemilihEvent />} />
        <Kosong
          icon={Wallet}
          judul="Belum ada data keuangan"
          keterangan="Buat sesi bazaar dan setujui PO pertama untuk melihat laporannya."
        />
      </>
    )
  }

  return (
    <>
      <HeaderHalaman judul="Keuangan" keterangan={event?.name} aksi={<PemilihEvent />} />

      <div className="space-y-3">
        {/* Export */}
        <Muncul>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-10 gap-2 text-xs" onClick={unduhPdf} disabled={mengekspor !== null}>
              {mengekspor === 'pdf' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Export PDF
            </Button>
            <Button variant="outline" className="h-10 gap-2 text-xs" onClick={unduhExcel} disabled={mengekspor !== null}>
              {mengekspor === 'excel' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Export Excel
            </Button>
          </div>
        </Muncul>

        {/* Laba bersih */}
        <Muncul delay={0.04}>
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Laba bersih</p>
            <p
              className={`tabular mt-1 text-3xl font-semibold tracking-tight ${
                Number(keuangan.net_profit) < 0 ? 'text-destructive' : 'text-primary'
              }`}
            >
              {rupiah(keuangan.net_profit)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Margin bersih {persen(keuangan.net_margin_pct)} · margin kotor{' '}
              {persen(keuangan.gross_margin_pct)}
            </p>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
              {[
                ['Omzet (PO disetujui)', rupiah(keuangan.revenue), ''],
                ['Modal produk (HPP)', `− ${rupiah(keuangan.capital_used)}`, 'text-muted-foreground'],
                ['Laba kotor', rupiah(keuangan.gross_profit), 'font-medium'],
                [
                  'Biaya operasional',
                  `− ${rupiah(keuangan.operating_expenses)}`,
                  'text-muted-foreground',
                ],
              ].map(([label, nilai, kelas]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={`tabular ${kelas}`}>{nilai}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Muncul>

        {/* Titik impas */}
        {progresBep !== null && (
          <Muncul delay={0.08}>
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Titik impas</h2>
                <span className="tabular text-xs text-muted-foreground">
                  {persen(progresBep, 0)} tertutup
                </span>
              </div>
              <Progress value={progresBep} className="mt-3 h-2" />
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {progresBep >= 100 ? (
                  <>
                    Biaya operasional sudah tertutup laba kotor. Setiap porsi berikutnya menambah
                    laba bersih.
                  </>
                ) : (
                  <>
                    Perlu omzet {rupiah(keuangan.bep_revenue ?? 0)}
                    {keuangan.bep_units ? ` (± ${angka(keuangan.bep_units)} porsi)` : ''} untuk
                    menutup biaya operasional {rupiah(keuangan.operating_expenses)}.
                  </>
                )}
              </p>
            </section>
          </Muncul>
        )}

        {/* Metrik */}
        <Muncul delay={0.12}>
          <div className="grid grid-cols-2 gap-3">
            <KartuStat
              label="Peserta PO"
              nilai={angka(keuangan.participants)}
              catatan={`${angka(keuangan.approved_orders)} PO disetujui`}
            />
            <KartuStat
              label="Rata-rata nilai PO"
              nilai={rupiahRingkas(keuangan.avg_order_value)}
              catatan={`${angka(keuangan.units_sold)} porsi terjual`}
            />
            <KartuStat
              label="Pembeli berulang"
              nilai={persen(repeatRate, 0)}
              catatan="Pesan lebih dari sekali"
            />
            <KartuStat
              label="Piutang"
              nilai={rupiahRingkas(keuangan.unpaid_value)}
              catatan="PO fix yang belum dibayar"
              nada={Number(keuangan.unpaid_value) > 0 ? 'negatif' : 'netral'}
            />
          </div>
        </Muncul>

        {/* Tren */}
        {dataChart.length > 1 && (
          <Muncul delay={0.16}>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Tren harian</h2>
              <ChartContainer config={chartConfig} className="aspect-[16/10] w-full">
                <AreaChart data={dataChart} margin={{ left: 4, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-omzet)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-omzet)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gLaba" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-laba)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-laba)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="hari" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    fontSize={10}
                    tickFormatter={(v) => rupiahRingkas(Number(v))}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">
                              {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                            </span>
                            <span className="tabular font-medium">{rupiah(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    dataKey="omzet"
                    type="monotone"
                    stroke="var(--color-omzet)"
                    fill="url(#gOmzet)"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="laba"
                    type="monotone"
                    stroke="var(--color-laba)"
                    fill="url(#gLaba)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </section>
          </Muncul>
        )}

        {/* Kontribusi per menu */}
        {performa && performa.length > 0 && (
          <Muncul delay={0.2}>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Kontribusi per menu</h2>
              <div className="space-y-3">
                {performa.map((p) => {
                  const kontribusi =
                    Number(keuangan.gross_profit) > 0
                      ? (Number(p.gross_profit) / Number(keuangan.gross_profit)) * 100
                      : 0
                  return (
                    <div key={p.menu_item_id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                        <span className="tabular shrink-0 text-xs text-primary">
                          {rupiahRingkas(p.gross_profit)}
                        </span>
                      </div>
                      <Progress value={kontribusi} className="h-1.5" />
                      <div className="tabular flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {p.units_sold}/{p.total_slots} porsi · serap {persen(p.sell_through_pct, 0)}
                        </span>
                        <span>{persen(kontribusi, 0)} dari laba</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </Muncul>
        )}

        {/* Biaya operasional */}
        <Muncul delay={0.24}>
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Biaya operasional</h2>
              {eventId && <DialogBiaya eventId={eventId} />}
            </div>

            {!biaya || biaya.length === 0 ? (
              <p className="py-2 text-xs leading-relaxed text-muted-foreground">
                Belum ada biaya tercatat, jadi laba bersih sama dengan laba kotor. Catat transport,
                kemasan, atau sewa stand agar laporannya akurat.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {biaya.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{b.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {labelKategori[b.category] ?? b.category} · {tanggal(b.incurred_at)}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-xs font-semibold">
                      {rupiah(b.amount)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-muted-foreground"
                      onClick={() => hapusBiaya.mutate(b.id)}
                      aria-label={`Hapus biaya ${b.label}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Muncul>
      </div>
    </>
  )
}
