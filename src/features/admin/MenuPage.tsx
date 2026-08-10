import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
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
import { persen, rupiah } from '@/lib/format'
import { pesanError } from '@/lib/supabase'
import { useEventTerpilih } from './event-terpilih'
import { PemilihEvent } from './PemilihEvent'
import { useHapusMenu, useMenuAdmin, useSimpanMenu } from '@/lib/queries/admin'
import type { MenuItem } from '@/types/database'

/**
 * Angka tetap berupa string di dalam form dan baru dikonversi saat submit.
 * Sengaja tidak memakai `.transform(Number)`: `FormField` bawaan shadcn tidak
 * meneruskan generic hasil transform Zod, sehingga tipe `control` jadi bentrok.
 */
const angkaMin0 = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi`)
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, `${label} harus angka minimal 0`)

const skema = z.object({
  name: z.string().trim().min(1, 'Nama menu wajib diisi').max(80),
  description: z.string().trim().max(200).optional(),
  image_url: z
    .string()
    .trim()
    .url('URL gambar tidak valid')
    .or(z.literal(''))
    .optional(),
  cost_price: angkaMin0('Harga modal'),
  sell_price: angkaMin0('Harga jual'),
  total_slots: angkaMin0('Jumlah slot'),
  max_per_user: angkaMin0('Batas per orang'),
  is_active: z.boolean(),
})

type FormMenu = z.infer<typeof skema>

const kosong: FormMenu = {
  name: '',
  description: '',
  image_url: '',
  cost_price: '0',
  sell_price: '0',
  total_slots: '0',
  max_per_user: '0',
  is_active: true,
}

function FormulirMenu({
  eventId,
  menu,
  onSelesai,
}: {
  eventId: string
  menu: MenuItem | null
  onSelesai: () => void
}) {
  const simpan = useSimpanMenu()

  const form = useForm<FormMenu>({
    resolver: zodResolver(skema),
    defaultValues: menu
      ? {
          name: menu.name,
          description: menu.description ?? '',
          image_url: menu.image_url ?? '',
          cost_price: String(menu.cost_price),
          sell_price: String(menu.sell_price),
          total_slots: String(menu.total_slots),
          max_per_user: String(menu.max_per_user),
          is_active: menu.is_active,
        }
      : kosong,
  })

  // Hitungan hidup: berapa untung per porsi dan kalau semua slot laku.
  const modal = Number(form.watch('cost_price')) || 0
  const jual = Number(form.watch('sell_price')) || 0
  const slot = Number(form.watch('total_slots')) || 0
  const untungPerPorsi = jual - modal
  const marginPersen = jual > 0 ? (untungPerPorsi / jual) * 100 : 0

  async function kirim(nilai: FormMenu) {
    try {
      await simpan.mutateAsync({
        id: menu?.id,
        nilai: {
          event_id: eventId,
          name: nilai.name,
          description: nilai.description || null,
          image_url: nilai.image_url || null,
          cost_price: Number(nilai.cost_price),
          sell_price: Number(nilai.sell_price),
          total_slots: Number(nilai.total_slots),
          max_per_user: Number(nilai.max_per_user),
          is_active: nilai.is_active,
        },
      })
      toast.success(menu ? 'Menu diperbarui' : 'Menu ditambahkan')
      onSelesai()
    } catch (e) {
      toast.error('Gagal menyimpan menu', { description: pesanError(e) })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(kirim)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama menu</FormLabel>
              <FormControl>
                <Input placeholder="Ayam Geprek Sambal Matah" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deskripsi</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Isi, level pedas, dll." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="cost_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Harga modal (HPP)</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sell_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Harga jual</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Umpan balik ekonomi langsung saat mengetik — supaya harga tidak ditebak-tebak. */}
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Untung/porsi</p>
            <p
              className={`tabular truncate text-sm font-semibold ${
                untungPerPorsi < 0 ? 'text-destructive' : 'text-primary'
              }`}
            >
              {rupiah(untungPerPorsi)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Margin</p>
            <p
              className={`tabular truncate text-sm font-semibold ${
                marginPersen < 0 ? 'text-destructive' : ''
              }`}
            >
              {persen(marginPersen)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Potensi laba</p>
            <p className="tabular truncate text-sm font-semibold">
              {rupiah(untungPerPorsi * slot)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="total_slots"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jumlah slot</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="max_per_user"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batas per orang</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={0} {...field} />
                </FormControl>
                <FormDescription className="text-[11px]">0 = tanpa batas</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL gambar</FormLabel>
              <FormControl>
                <Input placeholder="https://… (opsional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="space-y-0.5">
                <FormLabel>Tampilkan di tab War</FormLabel>
                <FormDescription className="text-[11px]">
                  Matikan untuk menyembunyikan sementara tanpa menghapus.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="h-11 w-full" disabled={simpan.isPending}>
          {simpan.isPending && <Loader2 className="size-4 animate-spin" />}
          {menu ? 'Simpan perubahan' : 'Tambahkan menu'}
        </Button>
      </form>
    </Form>
  )
}

export function MenuPage() {
  const { eventId, event } = useEventTerpilih()
  const { data: menu, isPending } = useMenuAdmin(eventId)
  const hapus = useHapusMenu()

  const [terbuka, setTerbuka] = useState(false)
  const [sedangEdit, setSedangEdit] = useState<MenuItem | null>(null)
  const [targetHapus, setTargetHapus] = useState<MenuItem | null>(null)

  function bukaBaru() {
    setSedangEdit(null)
    setTerbuka(true)
  }

  function bukaEdit(m: MenuItem) {
    setSedangEdit(m)
    setTerbuka(true)
  }

  async function konfirmasiHapus() {
    if (!targetHapus) return
    try {
      await hapus.mutateAsync(targetHapus.id)
      toast.success('Menu dihapus')
    } catch (e) {
      toast.error('Gagal menghapus', {
        description: `${pesanError(e)} — menu yang sudah pernah dipesan tidak bisa dihapus, nonaktifkan saja.`,
      })
    } finally {
      setTargetHapus(null)
    }
  }

  return (
    <>
      <HeaderHalaman
        judul="Menu"
        keterangan={event?.name}
        aksi={
          <>
            <PemilihEvent />
            <Button size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={bukaBaru} disabled={!eventId}>
              <Plus className="size-3.5" />
              Baru
            </Button>
          </>
        }
      />

      {isPending ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : !menu || menu.length === 0 ? (
        <Kosong
          icon={UtensilsCrossed}
          judul="Belum ada menu"
          keterangan="Tambahkan menu beserta harga modal dan harga jualnya agar laporan keuangan bisa dihitung."
          aksi={
            <Button size="sm" onClick={bukaBaru} disabled={!eventId}>
              Tambah menu
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {menu.map((m, i) => {
            const untung = Number(m.sell_price) - Number(m.cost_price)
            const margin = Number(m.sell_price) > 0 ? (untung / Number(m.sell_price)) * 100 : 0
            return (
              <Muncul key={m.id} delay={Math.min(i * 0.03, 0.24)}>
                <article className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex gap-3">
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl">
                      <GambarMenu nama={m.name} src={m.image_url} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold">{m.name}</h3>
                        {!m.is_active && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            Nonaktif
                          </Badge>
                        )}
                      </div>

                      <div className="tabular mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Modal {rupiah(m.cost_price)}</span>
                        <span>Jual {rupiah(m.sell_price)}</span>
                        <span className={untung < 0 ? 'text-destructive' : 'text-primary'}>
                          +{rupiah(untung)} ({persen(margin, 0)})
                        </span>
                        <span>{m.total_slots} slot</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => bukaEdit(m)}
                    >
                      <Pencil className="size-3.5" />
                      Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs text-muted-foreground"
                      onClick={() => setTargetHapus(m)}
                    >
                      <Trash2 className="size-3.5" />
                      Hapus
                    </Button>
                  </div>
                </article>
              </Muncul>
            )
          })}
        </div>
      )}

      <Drawer open={terbuka} onOpenChange={setTerbuka}>
        <DrawerContent>
          <div className="mx-auto flex max-h-[85vh] w-full max-w-md flex-col">
            <DrawerHeader className="text-left">
              <DrawerTitle>{sedangEdit ? 'Ubah menu' : 'Menu baru'}</DrawerTitle>
              <DrawerDescription>
                Harga modal dipakai untuk menghitung laba dan tidak pernah terlihat oleh customer.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4">
              {eventId && (
                <FormulirMenu
                  // key memaksa form dibuat ulang saat berpindah antar menu.
                  key={sedangEdit?.id ?? 'baru'}
                  eventId={eventId}
                  menu={sedangEdit}
                  onSelesai={() => setTerbuka(false)}
                />
              )}
            </div>

            <DrawerFooter />
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={Boolean(targetHapus)} onOpenChange={(o) => !o && setTargetHapus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {targetHapus?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Menu yang sudah pernah dipesan tidak bisa dihapus demi menjaga laporan keuangan tetap
              utuh. Untuk kasus itu, nonaktifkan saja lewat tombol Ubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={konfirmasiHapus} disabled={hapus.isPending}>
              {hapus.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
