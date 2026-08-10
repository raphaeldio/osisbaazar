import { useState } from 'react'
import { Check, Copy, Landmark, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { keFormatWa } from '@/lib/profil'

export type TujuanBayar = {
  payment_bank: string | null
  payment_account: string | null
  payment_holder: string | null
  payment_contact: string | null
}

/** Ada isinya atau tidak — dipakai pemanggil untuk memutuskan menampilkan kartunya. */
export function adaTujuanBayar(info: TujuanBayar | null | undefined): boolean {
  return Boolean(info && (info.payment_account || info.payment_contact))
}

/**
 * Tujuan transfer yang dilihat peserta.
 *
 * Nomor rekeningnya dibuat bisa disalin sekali ketuk: pemesan sedang memegang HP dan
 * akan pindah ke aplikasi bank, dan salah satu digit saja membuat uangnya nyasar.
 * Nomor panitia jadi tombol WhatsApp berisi sapaan siap kirim supaya bukti transfer
 * sampai ke orang yang benar, bukan ke grup kelas.
 */
export function InfoPembayaran({
  info,
  jumlah,
}: {
  info: TujuanBayar
  /** Kalau diisi, ikut disebut di pesan WhatsApp supaya panitia tahu konteksnya. */
  jumlah?: string
}) {
  const [tersalin, setTersalin] = useState(false)

  async function salin() {
    if (!info.payment_account) return
    try {
      await navigator.clipboard.writeText(info.payment_account.replace(/\s|-/g, ''))
      setTersalin(true)
      setTimeout(() => setTersalin(false), 1800)
    } catch {
      // Clipboard bisa ditolak browser. Nomornya tetap terbaca dan bisa disalin manual,
      // jadi tidak perlu mengagetkan pemesan dengan pesan error.
    }
  }

  const pesanWa = encodeURIComponent(
    `Halo panitia Bazaar OSIS, saya mau konfirmasi pembayaran PO saya${
      jumlah ? ` sebesar ${jumlah}` : ''
    }.`,
  )

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Landmark className="size-4 shrink-0 text-primary" />
        <h2 className="text-sm font-semibold">Bayar ke mana?</h2>
      </div>

      {info.payment_account && (
        <div className="rounded-xl border border-border bg-card p-3">
          {info.payment_bank && (
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {info.payment_bank}
            </p>
          )}
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="tabular min-w-0 flex-1 text-lg font-semibold break-all">
              {info.payment_account}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 text-xs"
              onClick={salin}
            >
              {tersalin ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              {tersalin ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
          {info.payment_holder && (
            <p className="mt-1 text-xs text-muted-foreground">a.n. {info.payment_holder}</p>
          )}
        </div>
      )}

      {info.payment_contact && (
        <a
          href={`https://wa.me/${keFormatWa(info.payment_contact)}?text=${pesanWa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
        >
          <MessageCircle className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium">Kirim bukti transfer ke panitia</span>
            <span className="tabular block text-[11px] text-muted-foreground">
              {info.payment_contact}
            </span>
          </span>
        </a>
      )}

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Slotmu baru terkunci setelah panitia mengonfirmasi pembayaranmu — jadi kirim
        buktinya secepatnya supaya tidak keburu direbut orang lain.
      </p>
    </section>
  )
}
