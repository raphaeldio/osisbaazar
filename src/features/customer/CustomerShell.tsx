import { useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { Flame, ReceiptText, Trophy, User } from 'lucide-react'
import { NavBawah, type ItemNav } from '@/components/NavBawah'
import { useAuth } from '@/features/auth/AuthProvider'
import { useNotifikasi, useNotifikasiRealtime, usePesananSaya } from '@/lib/queries/customer'
import type { NotificationRow } from '@/types/database'

export function CustomerShell() {
  const { session } = useAuth()
  const { data: pesanan } = usePesananSaya()
  const { data: notifikasi } = useNotifikasi()

  const menunggu = pesanan?.filter((p) => p.status === 'pending').length ?? 0
  const belumDibaca = notifikasi?.filter((n) => !n.read_at).length ?? 0

  const onNotifikasiBaru = useCallback((n: NotificationRow) => {
    if (n.type === 'approved') toast.success(n.title, { description: n.body ?? undefined })
    else if (n.type === 'rejected' || n.type === 'cancelled')
      toast.error(n.title, { description: n.body ?? undefined })
    else toast(n.title, { description: n.body ?? undefined })
  }, [])

  useNotifikasiRealtime(session?.user.id, onNotifikasiBaru)

  const item: ItemNav[] = [
    { ke: '/', label: 'War', icon: Flame, persis: true },
    { ke: '/pesanan', label: 'PO Saya', icon: ReceiptText, lencana: menunggu },
    { ke: '/peringkat', label: 'Peringkat', icon: Trophy },
    { ke: '/profil', label: 'Profil', icon: User, lencana: belumDibaca },
  ]

  return (
    <div className="min-h-dvh bg-background">
      {/* pb-24 memberi ruang untuk nav bawah yang melayang. */}
      <div className="mx-auto max-w-2xl px-4 pb-24">
        <Outlet />
      </div>
      <NavBawah item={item} />
    </div>
  )
}
