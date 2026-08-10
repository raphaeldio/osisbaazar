import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEventTerpilih } from './event-terpilih'

const labelStatus: Record<string, string> = {
  draft: 'Draf',
  open: 'Dibuka',
  closed: 'Ditutup',
}

/** Pemilih sesi bazaar yang dipakai di header semua halaman admin. */
export function PemilihEvent() {
  const { eventId, events, pilihEvent } = useEventTerpilih()

  if (events.length <= 1) return null

  return (
    <Select value={eventId} onValueChange={pilihEvent}>
      <SelectTrigger size="sm" className="max-w-[9.5rem] text-xs">
        <SelectValue placeholder="Pilih sesi" />
      </SelectTrigger>
      <SelectContent align="end">
        {events.map((e) => (
          <SelectItem key={e.id} value={e.id} className="text-xs">
            {e.name} · {labelStatus[e.status] ?? e.status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
