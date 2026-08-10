import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Bell, CheckCircle2, LogOut, UserPen, XCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { HeaderHalaman } from '@/components/HeaderHalaman'
import { Kosong } from '@/components/Kosong'
import { Muncul } from '@/components/Muncul'
import { cn } from '@/lib/utils'
import { inisial, rupiah, sejak } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  useNotifikasi,
  usePesananSaya,
  useTandaiNotifikasiTerbaca,
} from '@/lib/queries/customer'

const gayaNotifikasi = {
  approved: { ikon: CheckCircle2, kelas: 'text-primary' },
  rejected: { ikon: XCircle, kelas: 'text-destructive' },
  cancelled: { ikon: Ban, kelas: 'text-destructive' },
  expired: { ikon: XCircle, kelas: 'text-muted-foreground' },
  info: { ikon: Bell, kelas: 'text-muted-foreground' },
} as const

export function ProfilPage() {
  const { profile, keluar } = useAuth()
  const { data: pesanan } = usePesananSaya()
  const { data: notifikasi } = useNotifikasi()
  const tandaiTerbaca = useTandaiNotifikasiTerbaca()

  const disetujui = pesanan?.filter((p) => p.status === 'approved') ?? []
  const totalBelanja = disetujui.reduce((t, p) => t + Number(p.total_amount), 0)
  const belumDibaca = notifikasi?.filter((n) => !n.read_at).length ?? 0

  // Membuka tab ini artinya notifikasinya sudah dilihat.
  useEffect(() => {
    if (belumDibaca > 0) tandaiTerbaca.mutate()
    // Sengaja hanya bergantung pada jumlah, bukan objek mutation yang berganti identitas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belumDibaca])

  return (
    <>
      <HeaderHalaman judul="Profil" />

      <Muncul>
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-14 shrink-0">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback>{inisial(profile?.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{profile?.full_name ?? 'Pengguna'}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3.5 text-xs">
            <div>
              <dt className="text-muted-foreground">Kelas</dt>
              <dd className="mt-0.5 truncate font-medium">{profile?.class_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nomor HP</dt>
              <dd className="tabular mt-0.5 truncate font-medium">{profile?.phone ?? '—'}</dd>
            </div>
          </dl>

          <Button asChild variant="outline" size="sm" className="mt-3.5 h-9 w-full gap-1.5 text-xs">
            <Link to="/lengkapi-profil" state={{ ubah: true }}>
              <UserPen className="size-3.5" />
              Ubah data diri
            </Link>
          </Button>
        </section>
      </Muncul>

      <Muncul delay={0.05}>
        <section className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">PO disetujui</p>
            <p className="tabular mt-1 text-2xl font-semibold">{disetujui.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total belanja</p>
            <p className="tabular mt-1 truncate text-2xl font-semibold text-primary">
              {rupiah(totalBelanja)}
            </p>
          </div>
        </section>
      </Muncul>

      <Muncul delay={0.1}>
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Notifikasi
          </h2>

          {!notifikasi || notifikasi.length === 0 ? (
            <Kosong
              icon={Bell}
              judul="Belum ada notifikasi"
              keterangan="Kamu akan diberi tahu di sini saat panitia memutuskan PO-mu."
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {notifikasi.map((n) => {
                const gaya = gayaNotifikasi[n.type]
                const Ikon = gaya.ikon
                return (
                  <div key={n.id} className="flex gap-3 p-3">
                    <Ikon className={cn('mt-0.5 size-4 shrink-0', gaya.kelas)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">{sejak(n.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </Muncul>

      <Separator className="my-6" />

      <Button variant="outline" className="w-full gap-2" onClick={() => void keluar()}>
        <LogOut className="size-4" />
        Keluar
      </Button>
    </>
  )
}
