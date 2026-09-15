import type { PropsWithChildren } from 'react'
import { clsx } from 'clsx'

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={clsx(
        'seller-card rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}
