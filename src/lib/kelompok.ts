import type { AdminOrder } from '@/lib/queries/admin'

/**
 * Seluruh PO milik satu orang, digabung jadi satu kelompok.
 *
 * Alasannya praktis: peserta sering memesan beberapa kali secara terpisah — nambah
 * porsi, ganti pikiran, ikut pesanan teman. Ditampilkan sebagai kartu terpisah,
 * panitia harus mengingat sendiri bahwa "Rani" di baris 3 dan di baris 11 adalah orang
 * yang sama, lalu menagihnya dua kali. Dikelompokkan, satu orang = satu tagihan dan
 * satu percakapan WhatsApp.
 */
export type Kelompok = {
  userId: string
  pemesan: AdminOrder['pemesan']
  orders: AdminOrder[]
  /** Nilai seluruh PO dalam kelompok ini. */
  total: number
  menunggu: AdminOrder[]
  /** Nilai PO yang sudah fix tapi belum dibayar — inilah angka yang perlu ditagih. */
  belumDibayar: number
  /** Waktu PO terbaru, dipakai mengurutkan kelompok. */
  terbaru: number
}

/**
 * Mengelompokkan daftar PO per pemesan.
 *
 * Dipanggil SETELAH penyaringan tab, bukan sebelumnya. Konsekuensinya disengaja:
 * kartu di tab "Menunggu" hanya memuat PO yang menunggu, sehingga angka totalnya
 * menjawab pertanyaan yang sedang dikerjakan panitia saat itu — bukan mencampur PO
 * yang sudah lunas ke dalam daftar kerja.
 *
 * Urutan PO di dalam kelompok mengikuti urutan masukan (query admin sudah menyusunnya
 * dari yang terbaru). Antar kelompok diurutkan dari yang aktivitasnya paling baru,
 * karena itu yang paling mungkin sedang ditunggu orangnya.
 */
export function kelompokkanPO(daftar: AdminOrder[]): Kelompok[] {
  const peta = new Map<string, Kelompok>()

  for (const o of daftar) {
    let k = peta.get(o.user_id)
    if (!k) {
      k = {
        userId: o.user_id,
        pemesan: o.pemesan,
        orders: [],
        total: 0,
        menunggu: [],
        belumDibayar: 0,
        terbaru: 0,
      }
      peta.set(o.user_id, k)
    }

    k.orders.push(o)
    k.total += Number(o.total_amount)
    if (o.status === 'pending') k.menunggu.push(o)
    if (o.status === 'approved' && o.payment_status === 'unpaid') {
      k.belumDibayar += Number(o.total_amount)
    }
    k.terbaru = Math.max(k.terbaru, new Date(o.created_at).getTime())
  }

  return [...peta.values()].sort((a, b) => b.terbaru - a.terbaru)
}
