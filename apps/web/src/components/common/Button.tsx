import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { clsx } from 'clsx'
type Variant = 'primary' | 'outline' | 'ghost'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant }
export function Button({ children, className, variant = 'primary', ...props }: PropsWithChildren<ButtonProps>) {
  return <button className={clsx(
    'inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0',
    variant === 'primary' && 'bg-brand text-white shadow-lg shadow-brand/15 hover:brightness-110',
    variant === 'outline' && 'border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:border-brand/50 hover:bg-brand/5',
    variant === 'ghost' && 'bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]',
    className,
  )} {...props}>{children}</button>
}
