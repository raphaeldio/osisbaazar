import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { kunci } from '@/lib/query-client'
import { gabungSiaran } from '@/lib/siaran'
import type {
  EventRow,
  LeaderboardRow,
  MenuAvailability,
  MyOrder,
  NotificationRow,
} from '@/types/database'

/** Sesi PO yang sedang dibuka. Ini yang mengisi tab War. */
export function useEventAktif() {
  return useQuery({
    queryKey: kunci.eventAktif,
    queryFn: async (): Promise<EventRow | null> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useMenuTersedia(eventId: string | undefined) {
  return useQuery({
    queryKey: kunci.menuTersedia(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<MenuAvailability[]> => {
      const { data, error } = await supabase
        .from('v_menu_availability')
        .select('*')
        .eq('event_id', eventId!)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })
}

export function usePesananSaya() {
  return useQuery({
    queryKey: kunci.pesananSaya,
    queryFn: async (): Promise<MyOrder[]> => {
      const { data, error } = await supabase
        .from('v_my_orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useLeaderboard() {
  return useQuery({
    queryKey: kunci.leaderboard,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase
        .from('v_leaderboard')
        .select('*')
        .order('rank')
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useNotifikasi() {
  return useQuery({
    queryKey: kunci.notifikasi,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAmankanSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { menuItemId: string; quantity: number; notes?: string }) => {
      const { data, error } = await supabase.rpc('reserve_slot', {
        p_menu_item_id: input.menuItemId,
        p_quantity: input.quantity,
        p_notes: input.notes,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.pesananSaya })
      void qc.invalidateQueries({ queryKey: ['menu-tersedia'] })
    },
  })
}

export function useBatalkanPesanan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('cancel_my_order', { p_order_id: orderId })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.pesananSaya })
      void qc.invalidateQueries({ queryKey: ['menu-tersedia'] })
    },
  })
}

/** Menyimpan nama, kelas, dan nomor HP milik sendiri. */
export function useSimpanProfil() {
  return useMutation({
    mutationFn: async (input: { full_name: string; class_name: string; phone: string }) => {
      const { data: sesi } = await supabase.auth.getUser()
      const userId = sesi.user?.id
      if (!userId) throw new Error('Sesi berakhir. Coba masuk lagi.')

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: input.full_name,
          class_name: input.class_name,
          phone: input.phone,
        })
        .eq('id', userId)
      if (error) throw error
    },
  })
}

export function useTandaiNotifikasiTerbaca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_notifications_read')
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.notifikasi }),
  })
}

/**
 * Sisa slot hidup tanpa perlu refresh.
 *
 * Kenapa mendengarkan `slot_counters` dan bukan `orders`: Realtime menghormati RLS,
 * dan customer memang tidak punya izin baca `orders`. `slot_counters` adalah tabel
 * ringan tanpa data sensitif yang di-update trigger setiap kali pesanan berubah.
 */
export function useSlotRealtime(eventId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!eventId) return

    // Siaran tidak langsung jadi penyegaran — lihat alasannya di `gabungSiaran`.
    // Singkatnya: siaran diterima semua peserta bersamaan, jadi menyegarkan seketika
    // berarti ratusan permintaan serentak untuk satu perubahan angka.
    const penyegaran = gabungSiaran(() => {
      void qc.invalidateQueries({ queryKey: kunci.menuTersedia(eventId) })
    })

    const channel = supabase
      .channel(`slot-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slot_counters',
          filter: `event_id=eq.${eventId}`,
        },
        () => penyegaran.picu(),
      )
      .subscribe()

    return () => {
      penyegaran.batalkan()
      void supabase.removeChannel(channel)
    }
  }, [eventId, qc])
}

/** Notifikasi masuk realtime; dipakai untuk memunculkan toast di shell customer. */
export function useNotifikasiRealtime(userId: string | undefined, onBaru: (n: NotificationRow) => void) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onBaru(payload.new as NotificationRow)
          void qc.invalidateQueries({ queryKey: kunci.notifikasi })
          void qc.invalidateQueries({ queryKey: kunci.pesananSaya })
          void qc.invalidateQueries({ queryKey: kunci.leaderboard })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, onBaru, qc])
}
