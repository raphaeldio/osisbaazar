import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Phone } from 'lucide-react'
import { motion } from 'motion/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { inisial } from '@/lib/format'
import { pesanError } from '@/lib/supabase'
import { normalkanHp, profilLengkap, skemaProfil, type FormProfil } from '@/lib/profil'
import { useSimpanProfil } from '@/lib/queries/customer'
import { useAuth } from './AuthProvider'
import { LayarMuat } from '@/components/LayarMuat'

/**
 * Gerbang setelah login. Panitia perlu bisa menghubungi pemesan, jadi nama, kelas,
 * dan nomor HP dikumpulkan sekali di sini sebelum seseorang boleh memesan.
 * Halaman yang sama dipakai ulang dari tab Profil untuk mengubah data.
 */
export function LengkapiProfilPage() {
  const { profile, loading, muatUlangProfil, isAdmin } = useAuth()
  const simpan = useSimpanProfil()
  const navigate = useNavigate()
  const location = useLocation()

  const sedangUbah = (location.state as { ubah?: boolean } | null)?.ubah === true

  const form = useForm<FormProfil>({
    resolver: zodResolver(skemaProfil),
    values: {
      // Nama dari Google dipakai sebagai isian awal supaya tinggal dikoreksi.
      full_name: profile?.full_name ?? '',
      class_name: profile?.class_name ?? '',
      phone: profile?.phone ?? '',
    },
  })

  if (loading) return <LayarMuat />
  if (profile && profilLengkap(profile) && !sedangUbah) {
    return <Navigate to={isAdmin ? '/admin' : '/'} replace />
  }

  async function kirim(nilai: FormProfil) {
    try {
      await simpan.mutateAsync({
        full_name: nilai.full_name,
        class_name: nilai.class_name,
        phone: normalkanHp(nilai.phone),
      })
      await muatUlangProfil()
      toast.success(sedangUbah ? 'Data diperbarui' : 'Profil lengkap', {
        description: sedangUbah ? undefined : 'Selamat berburu slot!',
      })
      navigate(sedangUbah ? '/profil' : isAdmin ? '/admin' : '/', { replace: true })
    } catch (e) {
      toast.error('Gagal menyimpan', { description: pesanError(e) })
    }
  }

  return (
    <div className="min-h-dvh bg-background px-5 pt-safe pb-safe">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-sm py-10"
      >
        <div className="mb-7 flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
            <AvatarFallback>{inisial(profile?.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile?.email}</p>
            <p className="text-xs text-muted-foreground">Masuk lewat Google</p>
          </div>
        </div>

        <h1 className="text-2xl leading-tight font-semibold tracking-tight">
          {sedangUbah ? 'Ubah data diri' : 'Sedikit lagi'}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {sedangUbah
            ? 'Perbarui data supaya panitia tetap bisa menghubungimu.'
            : 'Panitia butuh data ini untuk menghubungimu saat PO diproses dan saat pesanan siap diambil.'}
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(kirim)} className="mt-7 space-y-5">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama lengkap</FormLabel>
                  <FormControl>
                    <Input placeholder="Rani Ayu Lestari" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="class_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kelas</FormLabel>
                  <FormControl>
                    <Input placeholder="XI IPA 2" autoCapitalize="characters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor HP / WhatsApp</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="081234567890"
                        className="pl-9"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Boleh diketik dengan +62 atau spasi — nanti dirapikan otomatis.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="h-12 w-full" disabled={simpan.isPending}>
              {simpan.isPending && <Loader2 className="size-4 animate-spin" />}
              {sedangUbah ? 'Simpan perubahan' : 'Simpan & mulai'}
            </Button>
          </form>
        </Form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Data ini hanya terlihat oleh panitia bazaar. Nomor HP-mu tidak muncul di papan
          peringkat maupun di layar peserta lain.
        </p>
      </motion.div>
    </div>
  )
}
