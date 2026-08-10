import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart } from 'recharts'
import { ArrowDownRight, ArrowUpRight, ClipboardCheck, Inbox, Plus, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import CountUp from '@/components/reactbits/CountUp'
import SpotlightCard from '@/components/reactbits/SpotlightCard'
import AnimatedList from '@/components/reactbits/AnimatedList'
import { GambarMenu } from '@/components/GambarMenu'
import { cn } from '@/lib/utils'
import { angka, persen, rupiah, rupiahRingkas, sejak } from '@/lib/format'
import { useEventTerpilih } from './event-terpilih'
import { PemilihEvent } from './PemilihEvent'
import { useKeuangan, useKeuanganHarian, useOrdersAdmin, usePerformaMenu } from '@/lib/queries/admin'

const WARNA = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function RingkasanPage() {
  const { eventId, event } = useEventTerpilih()
  const { data: keuangan, isPending } = useKeuangan(eventId)
  const { data: performa } = usePerformaMenu(eventId)
  const { data: harian } = useKeuanganHarian(eventId)
  const { data: orders } = useOrdersAdmin(eventId)

  // Delta dihitung dari dua hari terakhir yang punya transaksi — jujur dan mudah diverifikasi.
  const deret = harian ?? []
  const hariIni = deret.at(-1)
  const hariSebelum = deret.at(-2)
  const delta =
    hariIni && hariSebelum && Number(hariSebelum.gross_profit) > 0
      ? ((Number(hariIni.gross_profit) - Number(hariSebelum.gross_profit)) /
          Number(hariSebelum.gross_profit)) *
        100
      : null

  const komposisi = (performa ?? [])
    .filter((p) => Number(p.revenue) > 0)
    .slice(0, 5)
    .map((p, i) => ({ nama: p.name, nilai: Number(p.revenue), fill: WARNA[i % WARNA.length] }))

  const chartConfig: ChartConfig = Object.fromEntries(
    komposisi.map((k, i) => [k.nama, { label: k.nama, color: WARNA[i % WARNA.length] }]),
  )

  const terbaru = (orders ?? [])
    .filter((o) => o.status === 'approved')
    .sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? ''))
    .slice(0, 6)

  const menunggu = keuangan?.pending_orders ?? 0

  return (
    <>
      <HeaderHalaman
        judul="Ringkasan"
        keterangan={event?.name}
        aksi={<PemilihEvent />}
      />

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-44 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      ) : !keuangan ? (
        <Kosong
          icon={Wallet}
          judul="Belum ada sesi bazaar"
          keterangan="Buat sesi terlebih dahulu di halaman Pengaturan, lalu tambahkan menunya."
          aksi={
            <Button asChild size="sm">
              <Link to="/admin/pengaturan">Buat sesi</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Kartu saldo utama */}
          <Muncul>
            <SpotlightCard className="p-5">
              <p className="text-xs text-muted-foreground">
                {Number(keuangan.net_profit) < 0 ? 'Rugi bersih sementara' : 'Laba bersih terkumpul'}
              </p>
              <p
                className={cn(
                  'tabular mt-1.5 text-[2rem] leading-none font-semibold tracking-tight',
                  Number(keuangan.net_profit) < 0 && 'text-destructive',
                )}
              >
                <span className="text-muted-foreground">Rp</span>
                <CountUp to={Number(keuangan.net_profit)} className="ml-1" />
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {delta !== null && (
                  <Badge
                    className={cn(
                      'gap-0.5',
                      delta >= 0
                        ? 'bg-primary/15 text-primary hover:bg-primary/15'
                        : 'bg-destructive/15 text-destructive hover:bg-destructive/15',
                    )}
                  >
                    {delta >= 0 ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {persen(Math.abs(delta))}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {delta !== null ? 'dibanding hari sebelumnya' : 'margin bersih '}
                  {delta === null && persen(keuangan.net_margin_pct)}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Omzet</p>
                  <p className="tabular mt-0.5 truncate text-sm font-semibold">
                    {rupiah(keuangan.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Modal produk</p>
                  <p className="tabular mt-0.5 truncate text-sm font-semibold">
                    {rupiah(keuangan.capital_used)}
                  </p>
                </div>
              </div>
            </SpotlightCard>
          </Muncul>

          {/* Aksi cepat */}
          <Muncul delay={0.04}>
            <div className="grid grid-cols-2 gap-3">
              <Button asChild className="h-11 gap-2">
                <Link to="/admin/approval">
                  <ClipboardCheck className="size-4" />
                  Approval
                  {menunggu > 0 && (
                    <span className="tabular ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 text-[11px]">
                      {menunggu}
                    </span>
                  )}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 gap-2">
                <Link to="/admin/menu">
                  <Plus className="size-4" />
                  Tambah menu
                </Link>
              </Button>
            </div>
          </Muncul>

          {/* Metrik ringkas */}
          <Muncul delay={0.08}>
            <div className="grid grid-cols-2 gap-3">
              <KartuStat
                label="Peserta PO"
                nilai={angka(keuangan.participants)}
                catatan={`${keuangan.approved_orders} PO disetujui`}
              />
              <KartuStat
                label="Porsi terjual"
                nilai={angka(keuangan.units_sold)}
                catatan={`Rata-rata ${rupiahRingkas(keuangan.avg_order_value)} per PO`}
              />
              <KartuStat
                label="Menunggu konfirmasi"
                nilai={angka(keuangan.pending_orders)}
                catatan={`Senilai ${rupiahRingkas(keuangan.pending_value)}`}
                nada={menunggu > 0 ? 'negatif' : 'netral'}
              />
              <KartuStat
                label="Belum dibayar"
                nilai={rupiahRingkas(keuangan.unpaid_value)}
                catatan="Dari PO yang sudah fix"
                nada={Number(keuangan.unpaid_value) > 0 ? 'negatif' : 'netral'}
              />
            </div>
          </Muncul>

          {/* Komposisi omzet */}
          {komposisi.length > 0 && (
            <Muncul delay={0.12}>
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Omzet per menu</h2>
                <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-52">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, name) => (
                            <div className="flex w-full justify-between gap-4">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="tabular font-medium">{rupiah(Number(value))}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={komposisi}
                      dataKey="nilai"
                      nameKey="nama"
                      innerRadius="58%"
                      outerRadius="88%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {komposisi.map((k) => (
                        <Cell key={k.nama} fill={k.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                <ul className="mt-1 space-y-1.5">
                  {komposisi.map((k) => (
                    <li key={k.nama} className="flex items-center gap-2 text-xs">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: k.fill }}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{k.nama}</span>
                      <span className="tabular font-medium">{rupiahRingkas(k.nilai)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </Muncul>
          )}

          {/* Transaksi terbaru */}
          <Muncul delay={0.16}>
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">PO terbaru disetujui</h2>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Link to="/admin/approval">Lihat semua</Link>
                </Button>
              </div>

              {terbaru.length === 0 ? (
                <Kosong
                  icon={Inbox}
                  judul="Belum ada PO yang disetujui"
                  keterangan="PO yang sudah kamu konfirmasi akan muncul di sini."
                />
              ) : (
                <AnimatedList>
                  {terbaru.map((o) => (
                    <div key={o.id} className="flex items-center gap-3">
                      <div className="size-9 shrink-0 overflow-hidden rounded-lg">
                        <GambarMenu nama={o.menu?.name ?? '?'} src={o.menu?.image_url} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {o.menu?.name} × {o.quantity}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {o.pemesan?.full_name ?? 'Pengguna'} · {sejak(o.approved_at)}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-xs font-semibold text-primary">
                        +{rupiahRingkas(o.total_amount)}
                      </span>
                    </div>
                  ))}
                </AnimatedList>
              )}
            </section>
          </Muncul>
        </div>
      )}
    </>
  )
}
