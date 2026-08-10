import { z } from 'zod'
import type { Profile } from '@/types/database'

/**
 * Normalisasi nomor HP Indonesia ke bentuk baku 08xxxxxxxxx.
 * Menerima "+62 812-3456-7890", "62812...", "0812 3456 7890" — semuanya jadi sama,
 * supaya link telepon/WhatsApp di sisi admin tidak perlu menebak format.
 */
export function normalkanHp(input: string): string {
  const angka = input.replace(/[^\d+]/g, '')
  if (angka.startsWith('+62')) return `0${angka.slice(3)}`
  if (angka.startsWith('62')) return `0${angka.slice(2)}`
  if (angka.startsWith('8')) return `0${angka}`
  return angka
}

/** 08123456789 → +6281234567890, format yang dipakai wa.me */
export function keFormatWa(phone: string): string {
  const baku = normalkanHp(phone)
  return `62${baku.replace(/^0/, '')}`
}

export const skemaProfil = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, 'Nama lengkap minimal 3 huruf')
    .max(60, 'Nama terlalu panjang'),
  class_name: z
    .string()
    .trim()
    .min(1, 'Kelas wajib diisi')
    .max(20, 'Maksimal 20 karakter'),
  phone: z
    .string()
    .trim()
    .min(1, 'Nomor HP wajib diisi')
    .refine(
      (v) => /^0[0-9]{8,13}$/.test(normalkanHp(v)),
      'Nomor HP tidak valid. Contoh: 081234567890',
    ),
})

export type FormProfil = z.infer<typeof skemaProfil>

/**
 * Cerminan dari fungsi `profil_lengkap()` di database. Dipakai untuk mengarahkan
 * layar; penegakan sebenarnya tetap di dalam RPC `reserve_slot()`.
 */
export function profilLengkap(profile: Profile | null): boolean {
  if (!profile) return false
  return Boolean(
    profile.full_name?.trim() && profile.class_name?.trim() && profile.phone?.trim(),
  )
}
