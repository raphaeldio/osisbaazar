import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, LogOut, Plus, ShieldCheck, Trash2, UserPen, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
  FormDescription,
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
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { Muncul } from '@/components/Muncul'
import { cn } from '@/lib/utils'
import { inisial, tanggalJam } from '@/lib/format'
import { normalkanHp } from '@/lib/profil'
import { pesanError } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useEventTerpilih } from './event-terpilih'
import { useAdminEmails, useKelolaAdminEmail, useSimpanEvent } from '@/lib/queries/admin'
import type { EventRow, EventStatus } from '@/types/database'

const skemaEvent = z.object({
  name: z.string().trim().min(1, 'Nama sesi wajib diisi').max(80),
  description: z.string().trim().max(200).optional(),
  status: z.enum(['draft', 'open', 'closed']),
  // String, bukan number: `FormField` shadcn tidak meneruskan generic transform Zod.
  payment_hours: z
    .string()
    .trim()
    .min(1, 'Wajib diisi')
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 720,
      'Antara 1 dan 720 jam',
    ),
  closes_at: z.string().optional(),
  // Tujuan transfer. Semuanya opsional — bazaar yang hanya menerima tunai boleh
  // membiarkannya kosong, dan kartunya otomatis tidak muncul di sisi peserta.
  payment_bank: z.string().trim().max(40).optional(),
  payment_account: z.string().trim().max(40).optional(),
  payment_holder: z.string().trim().max(60).optional(),
  payment_contact: z.string().trim().max(20).optional(),
})
type FormEvent = z.infer<typeof skemaEvent>

const labelStatus: Record<EventStatus, string> = {
  draft: 'Draf — belum terlihat customer',
  open: 'Dibuka — customer bisa PO',
  closed: 'Ditutup — tidak menerima PO baru',
}

const warnaStatus: Record<EventStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-primary/15 text-primary hover:bg-primary/15',
  closed: 'bg-muted text-muted-foreground',
}

/** datetime-local butuh waktu lokal tanpa zona; toISOString() memberi UTC. */
function keInputLokal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

function DialogEvent({ event, pemicu }: { event: EventRow | null; pemicu: React.ReactNode }) {
  const [buka, setBuka] = useState(false)
  const simpan = useSimpanEvent()

  const form = useForm<FormEvent>({
    resolver: zodResolver(skemaEvent),
    defaultValues: event
      ? {
          name: event.name,
          description: event.description ?? '',
          status: event.status,
          payment_hours: String(event.payment_hours),
          closes_at: keInputLokal(event.closes_at),
          payment_bank: event.payment_bank ?? '',
          payment_account: event.payment_account ?? '',
          payment_holder: event.payment_holder ?? '',
          payment_contact: event.payment_contact ?? '',
        }
      : {
          name: '',
          description: '',
          status: 'draft',
          payment_hours: '24',
          closes_at: '',
          payment_bank: '',
          payment_account: '',
          payment_holder: '',
          payment_contact: '',
        },
  })

  async function kirim(nilai: FormEvent) {
    try {
      await simpan.mutateAsync({
        id: event?.id,
        nilai: {
          name: nilai.name,
          description: nilai.description || null,
          status: nilai.status,
          payment_hours: Number(nilai.payment_hours),
          closes_at: nilai.closes_at ? new Date(nilai.closes_at).toISOString() : null,
          // null, bukan string kosong: `adaTujuanBayar` di sisi peserta memeriksa
          // keberadaan nilai, dan '' akan lolos lalu menampilkan kartu kosong.
          payment_bank: nilai.payment_bank || null,
          payment_account: nilai.payment_account || null,
          payment_holder: nilai.payment_holder || null,
          payment_contact: nilai.payment_contact ? normalkanHp(nilai.payment_contact) : null,
        },
      })
      toast.success(event ? 'Sesi diperbarui' : 'Sesi dibuat')
      setBuka(false)
    } catch (e) {
      toast.error('Gagal menyimpan sesi', { description: pesanError(e) })
    }
  }

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Ubah sesi bazaar' : 'Sesi bazaar baru'}</DialogTitle>
          <DialogDescription>
            Satu sesi = satu periode PO dengan laporan keuangannya sendiri.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(kirim)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama sesi</FormLabel>
                  <FormControl>
                    <Input placeholder="Bazaar OSIS 2026" {...field} />
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
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Opsional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(labelStatus) as EventStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {labelStatus[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batas waktu bayar (jam)</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="numeric" min={1} max={720} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Dihitung sejak PO disetujui. Slot baru terkunci setelah kamu menandai
                    pembayarannya lunas; kalau lewat batas ini belum dibayar, PO dilepas
                    otomatis dan slotnya kembali tersedia.
                    <br />
                    <strong>Mengubah angka ini berlaku surut</strong> — seluruh PO yang
                    belum dibayar langsung ikut dihitung ulang dari waktu persetujuannya
                    masing-masing, dan hitung mundur di layar peserta berubah saat itu juga.
                    Hati-hati memperpendek: PO yang jadinya sudah lewat batas akan dilepas
                    dalam lima menit berikutnya.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="closes_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tutup otomatis</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Kosongkan kalau tidak ingin batas waktu.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Tujuan pembayaran</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Muncul di layar <strong>PO Saya</strong> peserta yang PO-nya sudah disetujui
                tapi belum dibayar. Kosongkan semuanya kalau bazaar kalian hanya menerima
                tunai — kartunya otomatis tidak ditampilkan.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="payment_bank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank / e-wallet</FormLabel>
                    <FormControl>
                      <Input placeholder="BCA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor rekening</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="1234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_holder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atas nama</FormLabel>
                  <FormControl>
                    <Input placeholder="Rani Ayu Lestari" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Ditampilkan supaya peserta bisa mencocokkan sebelum mengirim uang.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor HP panitia</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" placeholder="081234567890" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Jadi tombol WhatsApp untuk mengirim bukti transfer. Boleh diketik dengan
                    +62 atau spasi — nanti dirapikan otomatis.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={simpan.isPending}>
              {simpan.isPending && <Loader2 className="size-4 animate-spin" />}
              {event ? 'Simpan perubahan' : 'Buat sesi'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function KelolaAdmin() {
  const { profile } = useAuth()
  const { data: daftar } = useAdminEmails()
  const kelola = useKelolaAdminEmail()
  const [email, setEmail] = useState('')

  async function tambah() {
    const bersih = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bersih)) {
      toast.error('Format email tidak valid')
      return
    }
    try {
      await kelola.mutateAsync({ aksi: 'tambah', email: bersih })
      setEmail('')
      toast.success('Admin ditambahkan', {
        description: 'Kalau akunnya sudah pernah masuk, perannya langsung naik jadi admin.',
      })
    } catch (e) {
      toast.error('Gagal menambahkan', { description: pesanError(e) })
    }
  }

  async function hapus(target: string) {
    try {
      await kelola.mutateAsync({ aksi: 'hapus', email: target })
      toast.success('Admin dicabut')
    } catch (e) {
      toast.error('Gagal mencabut', { description: pesanError(e) })
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Admin</h2>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Email di daftar ini otomatis masuk sebagai admin saat login dengan Google. Selain itu,
        semua akun jadi customer biasa.
      </p>

      <div className="flex gap-2">
        <Input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void tambah()}
          placeholder="panitia@gmail.com"
          className="h-9 text-sm"
        />
        <Button size="sm" className="h-9 shrink-0 gap-1.5" onClick={tambah} disabled={kelola.isPending}>
          {kelola.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Tambah
        </Button>
      </div>

      {daftar && daftar.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {daftar.map((a) => {
            const iniSaya = a.email.toLowerCase() === profile?.email?.toLowerCase()
            return (
              <li key={a.email} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {a.email}
                    {iniSaya && <span className="text-primary"> (kamu)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ditambahkan {tanggalJam(a.created_at)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => void hapus(a.email)}
                  disabled={iniSaya}
                  aria-label={`Cabut admin ${a.email}`}
                  title={iniSaya ? 'Tidak bisa mencabut akses sendiri' : undefined}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Identitas panitia yang sedang masuk, plus jalan keluarnya. */
function KartuAkun() {
  const { profile, keluar } = useAuth()

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-11 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="text-xs">{inisial(profile?.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.full_name ?? 'Panitia'}</p>
          <p className="truncate text-[11px] text-muted-foreground">{profile?.email}</p>
          {(profile?.class_name || profile?.phone) && (
            <p className="tabular truncate text-[11px] text-muted-foreground">
              {[profile.class_name, profile.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
          <Link to="/lengkapi-profil" state={{ ubah: true }}>
            <UserPen className="size-3.5" />
            Ubah data diri
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 gap-1.5 text-xs text-muted-foreground"
          onClick={() => void keluar()}
        >
          <LogOut className="size-3.5" />
          Keluar
        </Button>
      </div>
    </section>
  )
}

export function PengaturanPage() {
  const { events, eventId, pilihEvent } = useEventTerpilih()

  return (
    <>
      <HeaderHalaman
        judul="Pengaturan"
        aksi={
          <DialogEvent
            event={null}
            pemicu={
              <Button size="sm" className="h-8 gap-1 px-2.5 text-xs">
                <Plus className="size-3.5" />
                Sesi baru
              </Button>
            }
          />
        }
      />

      <div className="space-y-3">
        <Muncul>
          <KartuAkun />
        </Muncul>

        <Muncul delay={0.05}>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Sesi bazaar</h2>

            {events.length === 0 ? (
              <p className="py-2 text-xs leading-relaxed text-muted-foreground">
                Belum ada sesi. Buat satu untuk mulai menerima PO.
              </p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className={cn(
                      'rounded-xl border p-3',
                      e.id === eventId ? 'border-primary/40 bg-primary/5' : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.name}</p>
                        <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
                          Batas bayar {e.payment_hours} jam
                          {e.closes_at && ` · tutup ${tanggalJam(e.closes_at)}`}
                        </p>
                      </div>
                      <Badge className={cn('shrink-0 text-[10px]', warnaStatus[e.status])}>
                        {e.status === 'open' ? 'Dibuka' : e.status === 'draft' ? 'Draf' : 'Ditutup'}
                      </Badge>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <DialogEvent
                        event={e}
                        pemicu={
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            Ubah
                          </Button>
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => pilihEvent(e.id)}
                        disabled={e.id === eventId}
                      >
                        {e.id === eventId ? 'Sedang dikelola' : 'Kelola sesi ini'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Muncul>

        <Muncul delay={0.1}>
          <KelolaAdmin />
        </Muncul>

        <Separator className="my-2" />

        <Muncul delay={0.15}>
          <Button asChild variant="outline" className="h-11 w-full gap-2">
            <Link to="/admin/peserta">
              <Users className="size-4" />
              Lihat daftar peserta PO
            </Link>
          </Button>
        </Muncul>
      </div>
    </>
  )
}
