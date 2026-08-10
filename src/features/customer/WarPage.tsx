import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Flame, Loader2, Minus, Plus } from 'lucide-react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { GambarMenu } from '@/components/GambarMenu'
import { Kosong } from '@/components/Kosong'
import { Muncul } from '@/components/Muncul'
import { rupiah, tanggalJam } from '@/lib/format'
import { pesanError } from '@/lib/supabase'
import {
  useAmankanSlot,
  useEventAktif,
  useMenuTersedia,
  useSlotRealtime,
} from '@/lib/queries/customer'
import type { MenuAvailability } from '@/types/database'

function KartuMenu({ menu, onPilih }: { menu: MenuAvailability; onPilih: () => void }) {
  // Slot baru terpakai setelah panitia mengonfirmasi pembayaran, jadi `slots_taken`
  // berarti "sudah dibayar". Yang masih mengantre bayar ditampilkan terpisah supaya
  // peserta tahu ada yang mengincar slot yang sama.
  const habis = menu.slots_left <= 0
  const terisiPersen = menu.total_slots > 0 ? (menu.slots_taken / menu.total_slots) * 100 : 0
  const antrePersen =
    menu.total_slots > 0
      ? Math.min((menu.slots_awaiting_payment / menu.total_slots) * 100, 100 - terisiPersen)
      : 0
  const menipis = !habis && menu.slots_left <= Math.max(3, Math.ceil(menu.total_slots * 0.15))
  const diperebutkan = !habis && menu.slots_awaiting_payment > menu.slots_left

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex gap-3 p-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-xl">
          <GambarMenu nama={menu.name} src={menu.image_url} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-sm font-semibold">{menu.name}</h3>
              {habis ? (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Habis
                </Badge>
              ) : menipis ? (
                <Badge className="shrink-0 bg-warning/15 text-[10px] text-warning hover:bg-warning/15">
                  Sisa {menu.slots_left}
                </Badge>
              ) : null}
            </div>
            {menu.description && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {menu.description}
              </p>
            )}
          </div>

          <p className="tabular text-sm font-semibold text-primary">{rupiah(menu.sell_price)}</p>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {/* Dua lapis: bagian penuh = sudah dibayar, bagian pudar = sedang antre bayar. */}
        <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-primary/25"
            style={{ width: `${terisiPersen + antrePersen}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${terisiPersen}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="tabular text-[11px] text-muted-foreground">
            {menu.slots_taken} dari {menu.total_slots} slot terbayar
            {menu.slots_awaiting_payment > 0 && (
              <>
                {' · '}
                <span className={diperebutkan ? 'text-warning' : undefined}>
                  {menu.slots_awaiting_payment} antre bayar
                </span>
              </>
            )}
          </p>
          <Button size="sm" className="h-8 px-4 text-xs" disabled={habis} onClick={onPilih}>
            {habis ? 'Slot habis' : 'Pesan Slot'}
          </Button>
        </div>
      </div>
    </article>
  )
}

function DrawerAmankan({
  menu,
  onTutup,
}: {
  menu: MenuAvailability | null
  onTutup: () => void
}) {
  const [jumlah, setJumlah] = useState(1)
  const [catatan, setCatatan] = useState('')
  const amankan = useAmankanSlot()

  const batasPerOrang = menu?.max_per_user ?? 0
  const maksimal = Math.min(
    menu?.slots_left ?? 1,
    batasPerOrang > 0 ? batasPerOrang : Number.MAX_SAFE_INTEGER,
  )

  async function kirim() {
    if (!menu) return
    try {
      await amankan.mutateAsync({
        menuItemId: menu.id,
        quantity: jumlah,
        notes: catatan.trim() || undefined,
      })
      toast.success('Pesanan masuk antrian', {
        description: 'Slotmu baru terkunci setelah panitia mengonfirmasi pembayaran.',
      })
      tutup()
    } catch (e) {
      toast.error('Gagal mengamankan slot', { description: pesanError(e) })
    }
  }

  function tutup() {
    setJumlah(1)
    setCatatan('')
    onTutup()
  }

  return (
    <Drawer open={Boolean(menu)} onOpenChange={(o) => !o && tutup()}>
      <DrawerContent>
        {menu && (
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader className="text-left">
              <DrawerTitle>{menu.name}</DrawerTitle>
              <DrawerDescription>
                {rupiah(menu.sell_price)} per porsi · sisa {menu.slots_left} slot belum terbayar
                {batasPerOrang > 0 && ` · maks ${batasPerOrang} per orang`}
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-5 px-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="text-sm text-muted-foreground">Jumlah porsi</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setJumlah((n) => Math.max(1, n - 1))}
                    disabled={jumlah <= 1}
                    aria-label="Kurangi"
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="tabular w-6 text-center text-base font-semibold">{jumlah}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setJumlah((n) => Math.min(maksimal, n + 1))}
                    disabled={jumlah >= maksimal}
                    aria-label="Tambah"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              <Textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Catatan untuk panitia (opsional) — misal: tidak pedas"
                rows={2}
                maxLength={200}
              />

              <div className="flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="tabular text-lg font-semibold">
                  {rupiah(menu.sell_price * jumlah)}
                </span>
              </div>
            </div>

            <DrawerFooter>
              <Button onClick={kirim} disabled={amankan.isPending} className="h-11">
                {amankan.isPending && <Loader2 className="size-4 animate-spin" />}
                Pesan {jumlah} porsi
              </Button>
              <DrawerClose asChild>
                <Button variant="ghost">Batal</Button>
              </DrawerClose>
              <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
                Memesan belum mengunci slot. Slot baru jadi milikmu setelah panitia menyetujui
                dan mengonfirmasi pembayaranmu — jadi bayarlah secepatnya.
              </p>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

export function WarPage() {
  const { data: event, isPending: memuatEvent } = useEventAktif()
  const { data: menu, isPending: memuatMenu } = useMenuTersedia(event?.id)
  const [dipilih, setDipilih] = useState<MenuAvailability | null>(null)

  useSlotRealtime(event?.id)

  const memuat = memuatEvent || (Boolean(event) && memuatMenu)

  return (
    <>
      <HeaderHalaman
        judul={event?.name ?? 'War Menu'}
        keterangan={
          event?.closes_at ? `Ditutup ${tanggalJam(event.closes_at)}` : 'Rebut slot sebelum habis'
        }
      />

      {memuat ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : !event ? (
        <Kosong
          icon={CalendarClock}
          judul="Belum ada sesi PO yang dibuka"
          keterangan="Panitia belum membuka sesi bazaar. Cek lagi nanti ya."
        />
      ) : menu && menu.length > 0 ? (
        <div className="space-y-3">
          {menu.map((m, i) => (
            <Muncul key={m.id} delay={Math.min(i * 0.03, 0.24)}>
              <KartuMenu menu={m} onPilih={() => setDipilih(m)} />
            </Muncul>
          ))}
        </div>
      ) : (
        <Kosong
          icon={Flame}
          judul="Menu belum tersedia"
          keterangan="Sesi sudah dibuka tapi panitia belum menambahkan menu apa pun."
        />
      )}

      <DrawerAmankan menu={dipilih} onTutup={() => setDipilih(null)} />
    </>
  )
}
