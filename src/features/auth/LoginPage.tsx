import { useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, ShieldCheck, Trophy, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { useAuth } from './AuthProvider'
import { pesanError } from '@/lib/supabase'

function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

const sorotan = [
  { icon: Zap, teks: 'Amankan slot menu favoritmu sebelum kehabisan' },
  { icon: ShieldCheck, teks: 'Pesanan dikonfirmasi langsung oleh panitia' },
  { icon: Trophy, teks: 'Naik peringkat di papan pembeli teratas' },
]

export function LoginPage() {
  const { masukDenganGoogle } = useAuth()
  const [proses, setProses] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function masuk() {
    setProses(true)
    setError(null)
    try {
      await masukDenganGoogle()
      // Halaman berpindah ke Google; state proses sengaja dibiarkan true.
    } catch (e) {
      setError(pesanError(e))
      setProses(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-background px-6 pt-safe pb-safe">
      {/* Sorotan lembut di latar — statis, tidak beranimasi. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--primary) 26%, transparent), transparent 70%)',
        }}
      />

      <div className="relative flex flex-1 flex-col justify-center py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="mb-8 space-y-3">
            <Logo bingkai animasi className="size-20" />
            <h1 className="text-3xl leading-tight font-semibold tracking-tight">
              Pre-Order
              <br />
              <span className="text-primary">tanpa rebutan chat.</span>
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pilih menu, amankan slotmu, lalu tunggu panitia mengonfirmasi. Semua tercatat rapi.
            </p>
          </div>

          <ul className="mb-8 space-y-3">
            {sorotan.map(({ icon: Icon, teks }, i) => (
              <motion.li
                key={teks}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.08 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card">
                  <Icon className="size-4 text-primary" />
                </span>
                {teks}
              </motion.li>
            ))}
          </ul>

          <Button size="lg" className="h-12 w-full gap-2.5 text-sm" onClick={masuk} disabled={proses}>
            {proses ? <Loader2 className="size-4 animate-spin" /> : <LogoGoogle />}
            {proses ? 'Mengarahkan ke Google…' : 'Masuk dengan Google'}
          </Button>

          {error && (
            <p className="mt-3 text-center text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            Belum punya akun? Tidak perlu daftar — akun Google-mu langsung dipakai.
          </p>
        </motion.div>
      </div>

      <p className="relative pb-6 text-center text-[11px] text-muted-foreground">
        Panitia yang emailnya terdaftar sebagai admin akan langsung masuk ke dashboard.
      </p>
    </div>
  )
}
