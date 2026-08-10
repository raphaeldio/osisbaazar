import { format, formatDistanceToNowStrict } from 'date-fns'
import { id } from 'date-fns/locale'

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const angkaFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** Rp1.250.000 */
export function rupiah(value: number | null | undefined): string {
  return rupiahFormatter.format(Number(value ?? 0))
}

/** 1.250.000 — untuk dipasangkan dengan label "Rp" terpisah. */
export function angka(value: number | null | undefined): string {
  return angkaFormatter.format(Number(value ?? 0))
}

/** Rp1,2 jt — dipakai di kartu sempit dan sumbu chart. */
export function rupiahRingkas(value: number | null | undefined): string {
  const n = Number(value ?? 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (abs >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (abs >= 1_000) return `Rp${(n / 1_000).toFixed(0)} rb`
  return `Rp${angkaFormatter.format(n)}`
}

export function persen(value: number | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toFixed(digits).replace('.', ',')}%`
}

export function tanggal(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return format(new Date(value), 'd MMM yyyy', { locale: id })
}

export function tanggalJam(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return format(new Date(value), 'd MMM yyyy, HH:mm', { locale: id })
}

/** "3 menit lalu" */
export function sejak(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return `${formatDistanceToNowStrict(new Date(value), { locale: id })} lalu`
}

/** Sisa waktu hold dalam bentuk mm:ss. Mengembalikan null kalau sudah lewat. */
export function sisaWaktu(until: string | null | undefined, now = Date.now()): string | null {
  if (!until) return null
  const ms = new Date(until).getTime() - now
  if (ms <= 0) return null
  const totalDetik = Math.floor(ms / 1000)
  const jam = Math.floor(totalDetik / 3600)
  const menit = Math.floor((totalDetik % 3600) / 60)
  const detik = totalDetik % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return jam > 0 ? `${jam}:${pad(menit)}:${pad(detik)}` : `${pad(menit)}:${pad(detik)}`
}

export function inisial(nama: string | null | undefined): string {
  if (!nama) return '?'
  return nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? '')
    .join('')
}
