import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /*
       * 30 detik, naik dari 15. Angka ini adalah rem utama untuk beban saat war.
       *
       * `refetchOnWindowFocus` menghormati `staleTime`: data yang masih segar TIDAK
       * ditembak ulang saat peserta kembali ke aplikasi. Jadi angka ini menentukan
       * batas atas beban dari perpindahan aplikasi — dengan 900 peserta yang bolak-balik
       * ke WhatsApp, 15 detik berarti sampai 60 permintaan/detik, sedangkan 30 detik
       * memotongnya jadi setengah.
       *
       * Kesegaran datanya sendiri tidak ikut turun: perubahan sisa slot tetap datang
       * seketika lewat realtime, dan setiap tindakan (memesan, menyetujui, menandai
       * lunas) menyegarkan query terkait secara eksplisit tanpa peduli staleTime.
       */
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

export const kunci = {
  eventAktif: ['event-aktif'] as const,
  events: ['events'] as const,
  menuTersedia: (eventId: string | undefined) => ['menu-tersedia', eventId] as const,
  menuAdmin: (eventId: string | undefined) => ['menu-admin', eventId] as const,
  pesananSaya: ['pesanan-saya'] as const,
  leaderboard: ['leaderboard'] as const,
  notifikasi: ['notifikasi'] as const,
  ordersAdmin: (eventId: string | undefined) => ['orders-admin', eventId] as const,
  keuangan: (eventId: string | undefined) => ['keuangan', eventId] as const,
  performaMenu: (eventId: string | undefined) => ['performa-menu', eventId] as const,
  peserta: (eventId: string | undefined) => ['peserta', eventId] as const,
  harian: (eventId: string | undefined) => ['harian', eventId] as const,
  biaya: (eventId: string | undefined) => ['biaya', eventId] as const,
  adminEmails: ['admin-emails'] as const,
}
