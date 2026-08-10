import { cn } from '@/lib/utils'

/** Warna latar stabil per nama, jadi menu yang sama selalu tampil sama. */
function nadaDari(nama: string) {
  let h = 0
  for (const ch of nama) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

export function GambarMenu({
  nama,
  src,
  className,
}: {
  nama: string
  src?: string | null
  className?: string
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={nama}
        loading="lazy"
        className={cn('size-full object-cover', className)}
      />
    )
  }

  // Pastel: lightness tinggi, chroma rendah — huruf memakai nada gelap dari
  // keluarga warna yang sama supaya tetap terbaca di atas latar seterang ini.
  const h = nadaDari(nama)
  return (
    <div
      className={cn('flex size-full items-center justify-center', className)}
      style={{
        background: `linear-gradient(140deg, oklch(0.91 0.055 ${h}), oklch(0.855 0.045 ${(h + 40) % 360}))`,
      }}
      aria-hidden
    >
      <span
        className="text-lg font-semibold"
        style={{ color: `oklch(0.46 0.07 ${h})` }}
      >
        {nama.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
