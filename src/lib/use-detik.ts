import { useEffect, useState } from 'react'

/**
 * Jam yang berdetak tiap detik, dipakai countdown hold slot.
 * Satu interval untuk seluruh daftar — jauh lebih murah daripada satu timer per kartu.
 */
export function useDetik(aktif = true) {
  const [sekarang, setSekarang] = useState(() => Date.now())

  useEffect(() => {
    if (!aktif) return
    const t = setInterval(() => setSekarang(Date.now()), 1000)
    return () => clearInterval(t)
  }, [aktif])

  return sekarang
}
