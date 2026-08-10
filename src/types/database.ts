/**
 * Bentuk skema Supabase. Dihasilkan dari database lalu dirapikan.
 * Regenerate kapan saja setelah mengubah skema:
 *   npx supabase gen types typescript --project-id txlfpyjzfnrzqmiswtxc > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid'
export type PaymentMethod = 'tunai' | 'transfer' | 'qris' | 'ewallet'
export type EventStatus = 'draft' | 'open' | 'closed'
export type ExpenseCategory =
  | 'transport'
  | 'kemasan'
  | 'sewa'
  | 'promosi'
  | 'peralatan'
  | 'lainnya'
export type UserRole = 'admin' | 'customer'

export type Database = {
  public: {
    Tables: {
      admin_emails: {
        Row: { email: string; note: string | null; created_at: string }
        Insert: { email: string; note?: string | null; created_at?: string }
        Update: { email?: string; note?: string | null }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          /** Kelas peserta, mis. "XI IPA 2". Wajib sebelum boleh PO. */
          class_name: string | null
          /** Nomor HP baku 08xxxxxxxxx. Wajib sebelum boleh PO. */
          phone: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          class_name?: string | null
          phone?: string | null
          role?: UserRole
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          class_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          name: string
          description: string | null
          status: EventStatus
          hold_minutes: number
          /** Batas waktu bayar (jam) setelah PO disetujui. Lewat ini, slot dilepas. */
          payment_hours: number
          /** Tujuan transfer yang ditampilkan ke peserta. Semuanya opsional. */
          payment_bank: string | null
          payment_account: string | null
          payment_holder: string | null
          payment_contact: string | null
          opens_at: string | null
          closes_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: EventStatus
          hold_minutes?: number
          payment_hours?: number
          payment_bank?: string | null
          payment_account?: string | null
          payment_holder?: string | null
          payment_contact?: string | null
          opens_at?: string | null
          closes_at?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          status?: EventStatus
          hold_minutes?: number
          payment_hours?: number
          payment_bank?: string | null
          payment_account?: string | null
          payment_holder?: string | null
          payment_contact?: string | null
          opens_at?: string | null
          closes_at?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          id: string
          event_id: string
          name: string
          description: string | null
          image_url: string | null
          cost_price: number
          sell_price: number
          total_slots: number
          max_per_user: number
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          description?: string | null
          image_url?: string | null
          cost_price?: number
          sell_price?: number
          total_slots?: number
          max_per_user?: number
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          description?: string | null
          image_url?: string | null
          cost_price?: number
          sell_price?: number
          total_slots?: number
          max_per_user?: number
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          user_id: string
          menu_item_id: string
          event_id: string
          quantity: number
          unit_cost_price: number
          unit_sell_price: number
          total_amount: number
          total_cost: number
          status: OrderStatus
          payment_status: PaymentStatus
          payment_method: PaymentMethod | null
          notes: string | null
          rejection_reason: string | null
          hold_expires_at: string | null
          /** Tenggat bayar; hanya terisi saat status approved & belum lunas. */
          payment_due_at: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          status?: OrderStatus
          payment_status?: PaymentStatus
          payment_method?: PaymentMethod | null
          notes?: string | null
        }
        Relationships: []
      }
      operating_expenses: {
        Row: {
          id: string
          event_id: string
          label: string
          category: ExpenseCategory
          amount: number
          incurred_at: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          label: string
          category?: ExpenseCategory
          amount: number
          incurred_at?: string
          created_by?: string | null
        }
        Update: {
          label?: string
          category?: ExpenseCategory
          amount?: number
          incurred_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'info' | 'approved' | 'rejected' | 'expired' | 'cancelled'
          title: string
          body: string | null
          order_id: string | null
          read_at: string | null
          created_at: string
        }
        Insert: never
        Update: { read_at?: string | null }
        Relationships: []
      }
      slot_counters: {
        Row: {
          menu_item_id: string
          event_id: string
          slots_taken: number
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      v_menu_availability: {
        Row: {
          id: string
          event_id: string
          event_name: string
          event_status: EventStatus
          closes_at: string | null
          name: string
          description: string | null
          image_url: string | null
          sell_price: number
          total_slots: number
          max_per_user: number
          is_active: boolean
          sort_order: number
          /** Porsi yang SUDAH DIBAYAR. Hanya ini yang memakan slot. */
          slots_taken: number
          slots_left: number
          /** Porsi yang sedang mengantre pembayaran (pending + disetujui belum lunas). */
          slots_awaiting_payment: number
        }
        Relationships: []
      }
      v_my_orders: {
        Row: {
          id: string
          menu_item_id: string
          event_id: string
          menu_name: string
          image_url: string | null
          event_name: string
          quantity: number
          unit_sell_price: number
          total_amount: number
          status: OrderStatus
          payment_status: PaymentStatus
          payment_method: PaymentMethod | null
          notes: string | null
          rejection_reason: string | null
          hold_expires_at: string | null
          approved_at: string | null
          created_at: string
          payment_due_at: string | null
          /** Ikut dari sesinya, supaya tujuan bayar tetap terbaca walau sesi sudah ditutup. */
          payment_bank: string | null
          payment_account: string | null
          payment_holder: string | null
          payment_contact: string | null
        }
        Relationships: []
      }
      v_leaderboard: {
        Row: {
          user_id: string
          full_name: string | null
          avatar_url: string | null
          total_spent: number
          order_count: number
          total_items: number
          rank: number
        }
        Relationships: []
      }
      v_menu_performance: {
        Row: {
          menu_item_id: string
          event_id: string
          name: string
          cost_price: number
          sell_price: number
          total_slots: number
          is_active: boolean
          unit_margin: number
          unit_margin_pct: number
          units_sold: number
          revenue: number
          capital_used: number
          gross_profit: number
          pending_units: number
          sell_through_pct: number
        }
        Relationships: []
      }
      v_event_financials: {
        Row: {
          event_id: string
          event_name: string
          status: EventStatus
          hold_minutes: number
          opens_at: string | null
          closes_at: string | null
          revenue: number
          capital_used: number
          gross_profit: number
          operating_expenses: number
          net_profit: number
          gross_margin_pct: number
          net_margin_pct: number
          participants: number
          approved_orders: number
          units_sold: number
          avg_order_value: number
          pending_orders: number
          pending_value: number
          unpaid_value: number
          bep_units: number | null
          bep_revenue: number | null
        }
        Relationships: []
      }
      v_participants: {
        Row: {
          user_id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
          class_name: string | null
          phone: string | null
          event_id: string
          approved_orders: number
          pending_orders: number
          total_spent: number
          total_items: number
          unpaid_amount: number
          last_order_at: string | null
        }
        Relationships: []
      }
      v_daily_finance: {
        Row: {
          event_id: string
          day: string
          revenue: number
          capital_used: number
          gross_profit: number
          orders: number
          units_sold: number
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      profil_lengkap: { Args: { p_user: string }; Returns: boolean }
      mark_notifications_read: { Args: Record<string, never>; Returns: undefined }
      reserve_slot: {
        Args: { p_menu_item_id: string; p_quantity?: number; p_notes?: string }
        Returns: string
      }
      cancel_my_order: { Args: { p_order_id: string }; Returns: undefined }
      approve_order: { Args: { p_order_id: string }; Returns: undefined }
      reject_order: { Args: { p_order_id: string; p_reason?: string }; Returns: undefined }
      cancel_order: { Args: { p_order_id: string; p_reason?: string }; Returns: undefined }
      set_order_payment: {
        Args: { p_order_id: string; p_payment_status: string; p_payment_method?: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']

/** Ambil tipe baris dari tabel atau view mana pun: Row<'v_my_orders'>. */
export type Row<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never

export type Insert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never

export type Update<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never

// Alias yang sering dipakai di komponen.
export type Profile = Row<'profiles'>
export type EventRow = Row<'events'>
export type MenuItem = Row<'menu_items'>
export type MenuAvailability = Row<'v_menu_availability'>
export type MyOrder = Row<'v_my_orders'>
export type OrderRow = Row<'orders'>
export type LeaderboardRow = Row<'v_leaderboard'>
export type MenuPerformance = Row<'v_menu_performance'>
export type EventFinancials = Row<'v_event_financials'>
export type ParticipantRow = Row<'v_participants'>
export type DailyFinance = Row<'v_daily_finance'>
export type ExpenseRow = Row<'operating_expenses'>
export type NotificationRow = Row<'notifications'>
