import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSemuaEvent } from '@/lib/queries/admin'
import type { EventRow } from '@/types/database'

type Nilai = {
  eventId: string | undefined
  event: EventRow | undefined
  events: EventRow[]
  pilihEvent: (id: string) => void
  /** false selama daftar event belum termuat. */
  siap: boolean
}

const Ctx = createContext<Nilai | null>(null)
const KUNCI_SIMPAN = 'osis-bazaar:event-terpilih'

/**
 * Seluruh dashboard admin berpusat pada satu sesi bazaar terpilih. Pilihannya
 * disimpan di localStorage supaya tidak berubah setiap kali halaman dimuat ulang.
 */
export function EventTerpilihProvider({ children }: { children: ReactNode }) {
  const { data: events, isPending } = useSemuaEvent()
  const [dipilih, setDipilih] = useState<string | undefined>(
    () => localStorage.getItem(KUNCI_SIMPAN) ?? undefined,
  )

  const daftar = useMemo(() => events ?? [], [events])

  useEffect(() => {
    if (daftar.length === 0) return
    const masihAda = dipilih && daftar.some((e) => e.id === dipilih)
    if (masihAda) return
    // Default: sesi yang sedang dibuka, kalau tidak ada ambil yang terbaru.
    const bawaan = daftar.find((e) => e.status === 'open') ?? daftar[0]
    setDipilih(bawaan.id)
    localStorage.setItem(KUNCI_SIMPAN, bawaan.id)
  }, [daftar, dipilih])

  const nilai: Nilai = {
    eventId: dipilih,
    event: daftar.find((e) => e.id === dipilih),
    events: daftar,
    pilihEvent: (id) => {
      setDipilih(id)
      localStorage.setItem(KUNCI_SIMPAN, id)
    },
    siap: !isPending,
  }

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEventTerpilih() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEventTerpilih harus dipakai di dalam <EventTerpilihProvider>')
  return ctx
}
