import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { kunci } from '@/lib/query-client'
import { gabungSiaran } from '@/lib/siaran'
import type {
  DailyFinance,
  EventFinancials,
  EventRow,
  ExpenseRow,
  Insert,
  MenuItem,
  MenuPerformance,
  OrderRow,
  ParticipantRow,
  PaymentMethod,
  Update,
} from '@/types/database'

/** Baris PO lengkap untuk halaman Approval: identitas & kontak pemesan + menunya. */
export type AdminOrder = OrderRow & {
  pemesan: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
    class_name: string | null
    phone: string | null
  } | null
  menu: { name: string; image_url: string | null } | null
}

export function useSemuaEvent() {
  return useQuery({
    queryKey: kunci.events,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMenuAdmin(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.menuAdmin(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('event_id', eventId!)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useOrdersAdmin(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.ordersAdmin(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<AdminOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          '*, pemesan:profiles!orders_user_id_fkey(full_name,email,avatar_url,class_name,phone), menu:menu_items(name,image_url)',
        )
        .eq('event_id', eventId!)
        .order('created_at', { ascending: false })
        .returns<AdminOrder[]>()
      if (error) throw error
      return data ?? []
    },
  })
}

export function useKeuangan(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.keuangan(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventFinancials | null> => {
      const { data, error } = await supabase
        .from('v_event_financials')
        .select('*')
        .eq('event_id', eventId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function usePerformaMenu(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.performaMenu(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<MenuPerformance[]> => {
      const { data, error } = await supabase
        .from('v_menu_performance')
        .select('*')
        .eq('event_id', eventId!)
        .order('revenue', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function usePeserta(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.peserta(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<ParticipantRow[]> => {
      const { data, error } = await supabase
        .from('v_participants')
        .select('*')
        .eq('event_id', eventId!)
        .order('total_spent', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useKeuanganHarian(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.harian(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<DailyFinance[]> => {
      const { data, error } = await supabase
        .from('v_daily_finance')
        .select('*')
        .eq('event_id', eventId!)
        .order('day')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useBiaya(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.biaya(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from('operating_expenses')
        .select('*')
        .eq('event_id', eventId!)
        .order('incurred_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAdminEmails() {
  return useQuery({
    queryKey: kunci.adminEmails,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_emails')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

/** Semua query yang angkanya ikut berubah begitu sebuah PO diputuskan. */
function segarkanSetelahKeputusan(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    'orders-admin',
    'keuangan',
    'performa-menu',
    'peserta',
    'harian',
    'menu-admin',
    'menu-tersedia',
  ]) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
  void qc.invalidateQueries({ queryKey: kunci.leaderboard })
}

export function useSetujuiPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('approve_order', { p_order_id: orderId })
      if (error) throw error
    },
    onSuccess: () => segarkanSetelahKeputusan(qc),
  })
}

export function useTolakPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orderId: string; alasan?: string }) => {
      const { error } = await supabase.rpc('reject_order', {
        p_order_id: input.orderId,
        p_reason: input.alasan,
      })
      if (error) throw error
    },
    onSuccess: () => segarkanSetelahKeputusan(qc),
  })
}

/**
 * Membatalkan PO yang sudah fix. Beda dari `useTolakPO`: menolak dipakai untuk PO
 * yang masih mengantre, membatalkan untuk yang sudah disetujui — termasuk yang sudah
 * dibayar, dan catatan pembayarannya sengaja dipertahankan sebagai jejak pengembalian.
 */
export function useBatalkanPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orderId: string; alasan?: string }) => {
      const { error } = await supabase.rpc('cancel_order', {
        p_order_id: input.orderId,
        p_reason: input.alasan,
      })
      if (error) throw error
    },
    onSuccess: () => segarkanSetelahKeputusan(qc),
  })
}

export function useSetPembayaran() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      orderId: string
      status: 'paid' | 'unpaid'
      metode?: PaymentMethod
    }) => {
      const { error } = await supabase.rpc('set_order_payment', {
        p_order_id: input.orderId,
        p_payment_status: input.status,
        p_payment_method: input.metode,
      })
      if (error) throw error
    },
    onSuccess: () => segarkanSetelahKeputusan(qc),
  })
}

export function useSimpanMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; nilai: Insert<'menu_items'> }) => {
      if (input.id) {
        const { error } = await supabase
          .from('menu_items')
          .update(input.nilai as Update<'menu_items'>)
          .eq('id', input.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('menu_items').insert(input.nilai)
        if (error) throw error
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['menu-admin'] })
      void qc.invalidateQueries({ queryKey: ['menu-tersedia'] })
      void qc.invalidateQueries({ queryKey: ['performa-menu'] })
    },
  })
}

export function useHapusMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['menu-admin'] })
      void qc.invalidateQueries({ queryKey: ['menu-tersedia'] })
    },
  })
}

export function useSimpanEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; nilai: Insert<'events'> }) => {
      if (input.id) {
        const { error } = await supabase
          .from('events')
          .update(input.nilai as Update<'events'>)
          .eq('id', input.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('events').insert(input.nilai)
        if (error) throw error
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.events })
      void qc.invalidateQueries({ queryKey: kunci.eventAktif })
    },
  })
}

export function useSimpanBiaya() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nilai: Insert<'operating_expenses'>) => {
      const { error } = await supabase.from('operating_expenses').insert(nilai)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['biaya'] })
      void qc.invalidateQueries({ queryKey: ['keuangan'] })
    },
  })
}

export function useHapusBiaya() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operating_expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['biaya'] })
      void qc.invalidateQueries({ queryKey: ['keuangan'] })
    },
  })
}

export function useKelolaAdminEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { aksi: 'tambah' | 'hapus'; email: string }) => {
      const email = input.email.trim().toLowerCase()
      if (input.aksi === 'tambah') {
        const { error } = await supabase.from('admin_emails').insert({ email })
        if (error) throw error
      } else {
        const { error } = await supabase.from('admin_emails').delete().eq('email', email)
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.adminEmails }),
  })
}

/**
 * Antrian approval ikut hidup: admin punya izin baca `orders`, jadi bisa langsung
 * mendengarkan tabelnya tanpa perantara.
 */
export function useOrdersRealtime(eventId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!eventId) return

    // Admin mendengarkan `orders` langsung, jadi saat war ia menerima satu siaran per
    // PO yang masuk — dan query antrian approval jauh lebih berat daripada query menu
    // (ikut menarik profil pemesan dan nama menu). Jendelanya dibuat lebih lebar dari
    // sisi peserta: panitia tidak perlu melihat tiap PO detik itu juga, dan yang
    // dihemat di sini adalah query paling mahal di seluruh aplikasi.
    const penyegaran = gabungSiaran(
      () => {
        void qc.invalidateQueries({ queryKey: kunci.ordersAdmin(eventId) })
        void qc.invalidateQueries({ queryKey: kunci.keuangan(eventId) })
      },
      { jendela: 1200, acak: 600 },
    )

    const channel = supabase
      .channel(`orders-admin-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `event_id=eq.${eventId}` },
        () => penyegaran.picu(),
      )
      .subscribe()

    return () => {
      penyegaran.batalkan()
      void supabase.removeChannel(channel)
    }
  }, [eventId, qc])
}
