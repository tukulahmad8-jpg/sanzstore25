import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Heart, LogOut, MapPin, Package, UserRound } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { useAuthStore } from '@/stores/auth.store'
import { getSupabaseClient } from '@/lib/supabase'
import { confirmAction, toast } from '@/lib/notify'

export function AuthDropdown() {
  const { user, login, register, resendSignupConfirmation, requestPasswordReset, updatePassword, logout } = useAuthStore()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [loginForm, setLoginForm] = useState({ identity: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({})
  const [registerTouched, setRegisterTouched] = useState<Record<string, boolean>>({})
  const [registering, setRegistering] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetForm, setResetForm] = useState({ password: '', confirm: '' })
  const [recovering, setRecovering] = useState(false)

  function updateRegisterField(field: keyof typeof registerForm, value: string) {
    const next = { ...registerForm, [field]: value }
    const touched = { ...registerTouched, [field]: true }
    setRegisterForm(next)
    setRegisterTouched(touched)
    setRegisterErrors(touchedRegisterErrors(next, touched))
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('email_confirmed') === '1') {
      setMode('login')
      setOpen(true)
      setNotice('Email berhasil diverifikasi. Akun Anda sudah aktif. Silakan masuk.')
      params.delete('email_confirmed')
      const query = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
    }

    if (params.get('password_recovery') === '1') {
      setMode('reset')
      setOpen(true)
      setError('')
      setNotice('Buat password baru untuk akun Anda.')
    }

    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
        setOpen(true)
        setError('')
        setNotice('Link reset password valid. Silakan buat password baru.')
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await login(loginForm.identity, loginForm.password)
      setOpen(false)
      setLoginForm({ identity: '', password: '' })
      toast('Berhasil masuk. Selamat datang kembali!', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login gagal'
      if (/email.*(not confirmed|unconfirmed)|confirm.*email/i.test(message)) {
        setPendingVerificationEmail(loginForm.identity.trim())
        setError('Email belum diverifikasi. Silakan klik link verifikasi yang kami kirim ke email Anda.')
      } else {
        const friendly = /invalid login credentials/i.test(message)
          ? 'Email atau kata sandi yang Anda masukkan salah.'
          : /rate limit|too many requests/i.test(message)
            ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
            : /network|fetch/i.test(message)
              ? 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.'
              : 'Login belum berhasil. Periksa kembali email dan kata sandi Anda.'
        setError(friendly)
      }
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')

    const errors = validateRegisterForm(registerForm)
    setRegisterErrors(errors)
    if (Object.keys(errors).length > 0) return

    setRegistering(true)
    try {
      const verificationEmail = registerForm.email.trim()
      const normalizedPhone = normalizeIndonesianPhone(registerForm.phone)
      const result = await register({ name: registerForm.name.trim(), email: verificationEmail, phone: normalizedPhone, password: registerForm.password })
      setRegisterForm({ name: '', email: '', phone: '', password: '', confirm: '' })
      setRegisterErrors({})
      setRegisterTouched({})
      if (result.requiresEmailConfirmation) {
        setPendingVerificationEmail(verificationEmail)
        setMode('login')
        setNotice('Pendaftaran berhasil. Silakan cek email dan klik link verifikasi sebelum login.')
      } else {
        setOpen(false)
        toast('Akun berhasil dibuat.', 'success')
      }
    } catch (err) {
      setError(friendlyAuthError(err, 'Pendaftaran belum berhasil karena layanan sedang bermasalah. Silakan coba lagi beberapa saat.'))
    } finally {
      setRegistering(false)
    }
  }

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault()
    const email = forgotEmail.trim()
    if (!email) {
      setError('Masukkan email akun Anda.')
      return
    }
    setError('')
    setNotice('')
    setRecovering(true)
    try {
      await requestPasswordReset(email)
      setNotice('Jika email terdaftar, link reset password sudah dikirim. Silakan cek Inbox atau Spam.')
    } catch (err) {
      setError(friendlyAuthError(err, 'Link reset belum dapat dikirim. Coba lagi beberapa saat.'))
    } finally {
      setRecovering(false)
    }
  }

  async function handleUpdatePassword(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (resetForm.password !== resetForm.confirm) {
      setError('Konfirmasi password baru tidak sama.')
      return
    }
    setRecovering(true)
    try {
      await updatePassword(resetForm.password)
      await logout()
      setResetForm({ password: '', confirm: '' })
      setMode('login')
      setOpen(true)
      setNotice('Password berhasil diubah. Silakan masuk dengan password baru.')
      window.history.replaceState({}, '', window.location.pathname)
    } catch (err) {
      setError(friendlyAuthError(err, 'Password belum dapat diperbarui. Silakan coba lagi.'))
    } finally {
      setRecovering(false)
    }
  }

  async function handleResendConfirmation() {
    const email = (pendingVerificationEmail || loginForm.identity).trim()
    if (!email) {
      setError('Masukkan email akun yang ingin diverifikasi.')
      return
    }
    setError('')
    setNotice('')
    setResending(true)
    try {
      await resendSignupConfirmation(email)
      setPendingVerificationEmail(email)
      setNotice('Email verifikasi baru sudah dikirim. Silakan cek Inbox atau Spam.')
    } catch (err) {
      setError(friendlyAuthError(err, 'Email verifikasi belum dapat dikirim ulang. Coba lagi beberapa saat.'))
    } finally {
      setResending(false)
    }
  }

  async function handleLogout() {
    if (!(await confirmAction('Yakin ingin logout?', { confirmText: 'Logout', danger: true }))) return
    try {
      await logout()
      setOpen(false)
      toast('Anda telah keluar dari akun.', 'success')
    } catch {
      toast('Logout belum berhasil. Periksa koneksi Anda lalu coba lagi.', 'error')
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => { setOpen((value) => !value); setError(''); setNotice('') }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 font-bold transition hover:border-brand hover:text-brand active:scale-95">
        <UserRound size={18} />
        <span>{user ? firstName(user.name) : 'Masuk'}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[999] w-[340px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-2xl">
          {mode === 'reset' ? (
            <form onSubmit={handleUpdatePassword} className="grid gap-3">
              <h3 className="text-xl font-black">Buat Password Baru</h3>
              <p className="text-sm text-[var(--muted)]">Gunakan minimal 8 karakter dan jangan gunakan password lama.</p>
              {error ? <div className="rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-500">{error}</div> : null}
              {notice ? <div className="rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-500">{notice}</div> : null}
              <Input required minLength={8} type="password" placeholder="Password baru" value={resetForm.password} onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })} />
              <Input required minLength={8} type="password" placeholder="Konfirmasi password baru" value={resetForm.confirm} onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })} />
              <Button disabled={recovering}>{recovering ? 'Menyimpan...' : 'Simpan Password Baru'}</Button>
              <button type="button" onClick={() => { setMode('forgot'); setError(''); setNotice('') }} className="text-sm font-bold text-brand hover:underline">Minta link reset baru</button>
            </form>
          ) : mode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="grid gap-3">
              <h3 className="text-xl font-black">Lupa Password</h3>
              <p className="text-sm text-[var(--muted)]">Masukkan email akun. Kami akan mengirim link untuk membuat password baru.</p>
              {error ? <div className="rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-500">{error}</div> : null}
              {notice ? <div className="rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-500">{notice}</div> : null}
              <Input required type="email" placeholder="Email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
              <Button disabled={recovering}>{recovering ? 'Mengirim...' : 'Kirim Link Reset'}</Button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setNotice('') }} className="text-sm font-bold text-brand hover:underline">Kembali ke Login</button>
            </form>
          ) : user ? (
            <div>
              <div className="mb-4 rounded-2xl bg-brand/10 p-4">
                <p className="font-black text-brand">Halo, {firstName(user.name)}</p>
                <p className="text-sm text-[var(--muted)]">{user.email}</p>
                <p className="text-sm text-[var(--muted)]">{user.phone}</p>
              </div>
              <nav className="grid gap-1">
                <Link to="/account?tab=profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-brand/10"><UserRound size={18} /> Profil</Link>
                <Link to="/account?tab=orders" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-brand/10"><Package size={18} /> Pesanan</Link>
                <Link to="/account?tab=wishlist" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-brand/10"><Heart size={18} /> Wishlist</Link>
                <Link to="/account?tab=address" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-brand/10"><MapPin size={18} /> Alamat</Link>
                <button onClick={() => void handleLogout()} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-left font-bold text-brand hover:bg-brand/10"><LogOut size={18} /> Logout</button>
              </nav>
            </div>
          ) : mode === 'login' ? (
            <form onSubmit={handleLogin} className="grid gap-3">
              <h3 className="text-xl font-black">Masuk ke Akun Anda</h3>
              {error ? <div className="rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-500">{error}</div> : null}
              {notice ? <div className="rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-500">{notice}</div> : null}
              <Input required placeholder="Email" value={loginForm.identity} onChange={(e) => setLoginForm({ ...loginForm, identity: e.target.value })} />
              <Input required type="password" placeholder="Kata Sandi" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
              <div className="text-right">
                <button type="button" onClick={() => { setForgotEmail(loginForm.identity.trim()); setMode('forgot'); setError(''); setNotice('') }} className="text-sm font-bold text-brand hover:underline">Lupa Password?</button>
              </div>
              <Button>Masuk</Button>
              {(pendingVerificationEmail || /verifikasi/i.test(error)) ? (
                <button type="button" disabled={resending} onClick={() => void handleResendConfirmation()} className="rounded-xl border border-brand/40 px-3 py-2 text-sm font-bold text-brand transition hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-60">
                  {resending ? 'Mengirim...' : 'Kirim Ulang Email Verifikasi'}
                </button>
              ) : null}
              <p className="text-center text-sm text-[var(--muted)]">Belum punya akun? <button type="button" onClick={() => { setMode('register'); setError(''); setNotice('') }} className="font-bold text-brand">Daftar</button></p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="grid gap-3">
              <h3 className="text-xl font-black">Daftar Akun</h3>
              {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-500">{error}</div> : null}
              <RegisterField error={registerErrors.name}>
                <Input required autoComplete="name" placeholder="Nama lengkap" value={registerForm.name} className={registerErrors.name ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/10' : ''} aria-invalid={!!registerErrors.name} onBlur={() => updateRegisterField('name', registerForm.name)} onChange={(e) => updateRegisterField('name', e.target.value)} />
              </RegisterField>
              <RegisterField error={registerErrors.email}>
                <Input required type="email" autoComplete="email" placeholder="Email" value={registerForm.email} className={registerErrors.email ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/10' : ''} aria-invalid={!!registerErrors.email} onBlur={() => updateRegisterField('email', registerForm.email)} onChange={(e) => updateRegisterField('email', e.target.value)} />
              </RegisterField>
              <RegisterField error={registerErrors.phone}>
                <Input required inputMode="numeric" autoComplete="tel" placeholder="WhatsApp, contoh 081234567890" value={registerForm.phone} className={registerErrors.phone ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/10' : ''} aria-invalid={!!registerErrors.phone} onBlur={() => updateRegisterField('phone', registerForm.phone)} onChange={(e) => updateRegisterField('phone', e.target.value.replace(/\D/g, '').slice(0, 13))} />
              </RegisterField>
              <RegisterField error={registerErrors.password}>
                <Input required type="password" autoComplete="new-password" placeholder="Password minimal 8 karakter" value={registerForm.password} className={registerErrors.password ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/10' : ''} aria-invalid={!!registerErrors.password} onBlur={() => updateRegisterField('password', registerForm.password)} onChange={(e) => updateRegisterField('password', e.target.value)} />
              </RegisterField>
              <RegisterField error={registerErrors.confirm}>
                <Input required type="password" autoComplete="new-password" placeholder="Konfirmasi Password" value={registerForm.confirm} className={registerErrors.confirm ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/10' : ''} aria-invalid={!!registerErrors.confirm} onBlur={() => updateRegisterField('confirm', registerForm.confirm)} onChange={(e) => updateRegisterField('confirm', e.target.value)} />
              </RegisterField>
              <Button disabled={registering || !isRegisterFormReady(registerForm)}>{registering ? 'Mendaftarkan...' : 'Daftar'}</Button>
              <p className="text-center text-sm text-[var(--muted)]">Sudah punya akun? <button type="button" onClick={() => { setMode('login'); setError(''); setNotice('') }} className="font-bold text-brand">Masuk</button></p>
            </form>
          )}
        </div>
      ) : null}
    </div>
  )
}

function firstName(name: string) {
  return name.trim().split(' ')[0] || 'Akun'
}

function friendlyAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  const safeMessages = [
    'Email ini sudah digunakan. Silakan login atau gunakan email lain.',
    'Email atau WhatsApp sudah terdaftar.',
    'Link reset password tidak valid atau sudah kedaluwarsa. Minta link reset baru.',
    'Password baru harus berbeda dari password sebelumnya.',
    'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
    'Logout belum berhasil. Periksa koneksi Anda lalu coba lagi.',
  ]
  if (safeMessages.includes(message)) return message
  if (/invalid login credentials/i.test(message)) return 'Email atau kata sandi yang Anda masukkan salah.'
  if (/user already registered|already.*registered/i.test(message)) return 'Email ini sudah terdaftar. Silakan masuk atau gunakan Lupa Password.'
  if (/email.*not confirmed|unconfirmed/i.test(message)) return 'Email belum diverifikasi. Silakan cek email verifikasi Anda.'
  if (/rate limit|too many requests/i.test(message)) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
  if (/password.*(short|least)|weak password/i.test(message)) return 'Kata sandi terlalu lemah. Gunakan minimal 8 karakter.'
  if (/network|fetch/i.test(message)) return 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.'
  return fallback
}

function RegisterField({ error, children }: { error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      {children}
      {error ? <p className="px-1 text-xs font-semibold text-red-500">{error}</p> : null}
    </div>
  )
}

function normalizeIndonesianPhone(value: string) {
  return value.replace(/\D/g, '')
}

function touchedRegisterErrors(form: Parameters<typeof validateRegisterForm>[0], touched: Record<string, boolean>) {
  return Object.fromEntries(Object.entries(validateRegisterForm(form)).filter(([field]) => touched[field]))
}


function isRegisterFormReady(form: { name: string; email: string; phone: string; password: string; confirm: string }) {
  return Object.keys(validateRegisterForm(form)).length === 0
}

function validateRegisterForm(form: { name: string; email: string; phone: string; password: string; confirm: string }) {
  const errors: Record<string, string> = {}
  const name = form.name.trim()
  const email = form.email.trim()
  const phone = form.phone.replace(/\D/g, '')

  if (name.length < 2) errors.name = 'Nama minimal 2 karakter.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Masukkan alamat email yang valid.'
  if (!/^08\d{8,11}$/.test(phone)) errors.phone = 'Nomor WhatsApp belum valid. Gunakan format 08xxxxxxxxxx.'
  if (form.password.length < 8) errors.password = 'Password minimal 8 karakter.'
  if (!form.confirm) errors.confirm = 'Ulangi password Anda.'
  else if (form.password !== form.confirm) errors.confirm = 'Konfirmasi password tidak sama.'

  return errors
}
