import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY belum diisi. Salin .env.example jadi .env.local.',
  )
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

/**
 * Pesan error dari Postgres (RAISE EXCEPTION di RPC) sudah berbahasa Indonesia dan
 * layak ditampilkan apa adanya. Sisanya diganti kalimat netral supaya user tidak
 * melihat jeroan teknis.
 */
export function pesanError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message: unknown }).message)
    if (/JWT|fetch|network|failed to/i.test(message)) {
      return 'Koneksi bermasalah. Coba lagi sebentar lagi.'
    }
    return message
  }
  return 'Terjadi kesalahan yang tidak terduga.'
}
