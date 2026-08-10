import type {
  AdminOrder,
} from '@/lib/queries/admin'
import type {
  EventFinancials,
  EventRow,
  ExpenseRow,
  MenuPerformance,
  ParticipantRow,
} from '@/types/database'

/** Satu paket data yang dipakai bersama oleh export PDF maupun Excel. */
export type LaporanData = {
  event: EventRow
  keuangan: EventFinancials
  performa: MenuPerformance[]
  biaya: ExpenseRow[]
  peserta: ParticipantRow[]
  orders: AdminOrder[]
}

export const labelStatus: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
}

export const labelKategori: Record<string, string> = {
  transport: 'Transport',
  kemasan: 'Kemasan',
  sewa: 'Sewa',
  promosi: 'Promosi',
  peralatan: 'Peralatan',
  lainnya: 'Lainnya',
}

/** osis-bazaar-keuangan-bazaar-osis-2026-2026-08-09 */
export function namaBerkas(event: EventRow, jenis: string) {
  const slug = event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const tanggal = new Date().toISOString().slice(0, 10)
  return `${jenis}-${slug}-${tanggal}`
}

export function unduh(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
