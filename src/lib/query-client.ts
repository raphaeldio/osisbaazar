import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data slot berubah cepat saat war; sisanya tidak perlu sering ditembak ulang.
      staleTime: 15_000,
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
