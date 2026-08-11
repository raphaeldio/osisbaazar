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

/**
 * Perubahan pada sesi bazaar ikut hidup di layar peserta.
 *
 * Yang paling terasa: panitia mengubah **batas waktu bayar**. Trigger di database
 * menyelaraskan `payment_due_at` seluruh PO yang belum lunas, dan siaran ini yang
 * membuat hitung mundur di layar peserta ikut berubah tanpa perlu refresh.
 *
 * Kenapa mendengarkan `events` dan bukan `orders`: Realtime menghormati RLS, dan
 * customer memang tidak punya izin baca `orders` — event dari tabel itu tidak akan
 * pernah sampai ke mereka. `events` boleh dibaca semua user yang sudah login.
 *
 * Tanpa filter `event_id` dengan sengaja: PO lama bisa milik sesi yang sudah ditutup,
 * dan tabel `events` isinya cuma segelintir baris yang jarang berubah.
 */
export function useEventRealtime() {
  const qc = useQueryClient()

  useEffect(() => {
    /*
     * Penyegaran lewat jaringan sengaja dibuat lambat dan sangat teracak (1,5–7,5 detik).
     * Boleh lambat karena angka di layar sudah diperbarui seketika oleh `terapkanTenggat`
     * di bawah — permintaan ini hanya untuk merapikan sisanya (status sesi berubah,
     * rekening diganti). Kalau 900 peserta menyegarkan serentak begitu panitia menyentuh
     * satu angka, kita cuma memindahkan badai yang sudah ditambal di migrasi 0013.
     */
    const penyegaran = gabungSiaran(
      () => {
        void qc.invalidateQueries({ queryKey: kunci.pesananSaya })
        void qc.invalidateQueries({ queryKey: kunci.eventAktif })
      },
      { jendela: 1500, acak: 6000 },
    )

    const channel = supabase
      .channel('events-peserta')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        (payload) => {
          const sesi = payload.new as { id?: string; payment_hours?: number }
          if (sesi?.id && typeof sesi.payment_hours === 'number') {
            terapkanTenggat(qc, sesi.id, sesi.payment_hours)
          }
          penyegaran.picu()
        },
      )
      .subscribe()

    return () => {
      penyegaran.batalkan()
      void supabase.removeChannel(channel)
    }
  }, [qc])
}

/**
 * Memperbarui hitung mundur di cache langsung dari isi siaran — tanpa permintaan baru.
 *
 * Payload realtime sudah membawa `payment_hours` yang baru, dan setiap PO sudah memuat
 * `approved_at`. Jadi tenggatnya bisa dihitung di sini, dan layar peserta berubah dalam
 * hitungan milidetik alih-alih menunggu satu putaran ke server. Dengan ratusan peserta
 * online, ini bedanya antara nol permintaan dan ratusan permintaan serentak.
 *
 * CERMINAN dari trigger `selaraskan_tenggat_bayar()` di `0014_tenggat_ikut_berubah.sql` —
 * rumusnya (`approved_at + payment_hours`, hanya untuk PO approved+unpaid) harus sama
 * persis. Kalau salah satunya diubah, ubah keduanya. Angka dari server tetap yang
 * menang: penyegaran yang menyusul akan menimpanya.
 */
function terapkanTenggat(
  qc: ReturnType<typeof useQueryClient>,
  eventId: string,
  paymentHours: number,
) {
  qc.setQueryData<MyOrder[]>(kunci.pesananSaya, (lama) =>
    lama?.map((p) => {
      if (p.event_id !== eventId) return p
      if (p.status !== 'approved' || p.payment_status !== 'unpaid') return p

      const mulai = new Date(p.approved_at ?? p.created_at).getTime()
      return { ...p, payment_due_at: new Date(mulai + paymentHours * 3_600_000).toISOString() }
    }),
  )
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
