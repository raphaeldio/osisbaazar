/**
 * Menggabungkan siaran realtime yang datang beruntun menjadi satu penyegaran.
 *
 * Ada dua masalah berbeda yang diselesaikan sekaligus, dan keduanya baru terasa
 * saat ratusan orang membuka aplikasi bersamaan:
 *
 * 1. BERUNTUN. Sepuluh PO masuk dalam dua detik berarti sepuluh siaran, dan tanpa
 *    penggabungan tiap siaran memicu satu penyegaran. Padahal hasil akhirnya sama.
 *
 * 2. SERENTAK. Satu siaran diterima SEMUA peserta pada milidetik yang hampir sama.
 *    Menyegarkan tepat saat itu berarti 900 permintaan menghantam server dalam satu
 *    detak. Karena itu jedanya diberi komponen acak: bebannya jadi tersebar, bukan
 *    menumpuk.
 *
 * Sengaja memakai pola "yang pertama menjadwalkan, sisanya menumpang" — bukan debounce
 * yang mengulang hitungan tiap kali ada siaran baru. Debounce berbahaya di sini: selama
 * war siarannya nyaris tak putus, sehingga hitungannya akan terus di-reset dan layar
 * peserta justru tidak pernah ter-update. Dengan pola ini, penyegaran dijamin terjadi
 * paling lambat `jendela + acak` milidetik setelah siaran pertama.
 */
export function gabungSiaran(
  kerjakan: () => void,
  { jendela = 700, acak = 800 }: { jendela?: number; acak?: number } = {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined

  return {
    /** Dipanggil tiap kali siaran masuk. Aman dipanggil berkali-kali. */
    picu() {
      if (timer) return // sudah ada penyegaran yang menunggu — siaran ini ikut saja
      timer = setTimeout(() => {
        timer = undefined
        kerjakan()
      }, jendela + Math.random() * acak)
    },
    /** Wajib dipanggil saat komponen dilepas, supaya tidak menyegarkan layar yang sudah pergi. */
    batalkan() {
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}
