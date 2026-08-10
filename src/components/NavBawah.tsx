import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ItemNav = {
  ke: string
  label: string
  icon: LucideIcon
  /** true hanya untuk route index, agar tab tidak ikut aktif di sub-halaman. */
  persis?: boolean
  lencana?: number
}

/**
 * Navigasi utama. Mobile-first: menempel di bawah dalam jangkauan jempol.
 * Di layar lebar ikut melebar mengikuti kontainer, bukan pindah ke samping —
 * satu pola navigasi lebih mudah dipahami daripada dua.
 */
export function NavBawah({ item }: { item: ItemNav[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-2xl items-stretch px-2 pb-safe">
        {item.map(({ ke, label, icon: Icon, persis, lencana }) => (
          <NavLink
            key={ke}
            to={ke}
            end={persis}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-1 rounded-lg py-2.5 text-[11px] font-medium transition-colors duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className={cn('size-5 transition-transform duration-150', isActive && 'scale-105')} />
                  {Boolean(lencana) && (
                    <span className="absolute -top-1 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-4 font-semibold text-destructive-foreground">
                      {lencana! > 99 ? '99+' : lencana}
                    </span>
                  )}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
