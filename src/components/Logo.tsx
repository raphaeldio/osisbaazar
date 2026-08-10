import { cn } from '@/lib/utils'

/** Satu-satunya tempat nama berkas logo ditulis. Ganti ke `/logo.png` kalau logonya PNG. */
const berkas = '/logo.png'

/**
 * Logo organisasi.
 *
 * Gambarnya diambil dari `public/logo.png`. Untuk menggantinya, cukup timpa file itu —
 * tidak ada kode yang perlu diubah. Kalau nama berkasnya berbeda, ganti konstanta
 * `berkas` di atas dan `<link rel="icon">` di `index.html`.
 *
 * `bingkai` membungkus logo dengan pigura: kotak membulat berpadding, bergaris tipis,
 * dengan halo pastel di belakangnya. Ini bukan hiasan semata — logo kiriman bisa
 * berbentuk apa saja dan berlatar putih atau transparan, dan pigura memberinya bidang
 * yang konsisten supaya proporsinya tetap rapi apa pun gambar yang dimasukkan.
 *
 * `animasi` menyalakan tiga gerakan halus yang didefinisikan di `index.css`: pigura
 * masuk (fade + skala), logo mengapung pelan naik-turun, dan halo berdenyut.
 * `prefers-reduced-motion` mematikan ketiganya lewat aturan global.
 */
export function Logo({
  className,
  withLabel = false,
  label = 'Bazaar OSIS',
  bingkai = false,
  animasi = false,
}: {
  className?: string
  withLabel?: boolean
  label?: string
  bingkai?: boolean
  animasi?: boolean
}) {
  const gambar = (
    <img
      src={berkas}
      alt={withLabel ? '' : label}
      aria-hidden={withLabel || undefined}
      className={cn('object-contain', bingkai ? 'size-full' : cn('size-10 shrink-0', className))}
    />
  )

  const tanda = bingkai ? (
    <span
      className={cn(
        'logo-pigura relative inline-flex size-16 shrink-0 items-center justify-center',
        'rounded-2xl border border-border bg-card p-2.5 shadow-sm',
        animasi && 'logo-hidup',
        className,
      )}
    >
      <span aria-hidden className="logo-halo pointer-events-none absolute inset-0 rounded-2xl" />
      <span className="logo-isi relative block size-full">{gambar}</span>
    </span>
  ) : (
    gambar
  )

  if (!withLabel) return tanda

  return (
    <div className="flex items-center gap-2.5">
      {tanda}
      <span className="text-sm font-semibold tracking-tight">{label}</span>
    </div>
  )
}
