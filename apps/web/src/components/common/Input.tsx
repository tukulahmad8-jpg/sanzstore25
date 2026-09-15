import type { InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('h-11 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-brand/70 focus:ring-4 focus:ring-brand/10', className)} {...props} />
}
