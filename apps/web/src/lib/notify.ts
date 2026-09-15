function ensureLayer() {
  let layer = document.getElementById('sanz-notify-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'sanz-notify-layer'
    document.body.appendChild(layer)
  }
  return layer
}

const icons = { success: '✓', error: '!', default: 'i' } as const
const titles = { success: 'Berhasil', error: 'Belum berhasil', default: 'Informasi' } as const

export function toast(message: string, tone: 'default' | 'success' | 'error' = 'default') {
  const layer = ensureLayer()
  const el = document.createElement('div')
  el.className = `sanz-toast sanz-toast-${tone}`
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status')
  el.innerHTML = `<span class="sanz-toast-icon" aria-hidden="true">${icons[tone]}</span><span class="sanz-toast-copy"><strong>${titles[tone]}</strong><span></span></span><button type="button" class="sanz-toast-close" aria-label="Tutup">×</button>`
  el.querySelector<HTMLElement>('.sanz-toast-copy span')!.textContent = message
  const close = () => {
    el.classList.remove('is-visible')
    window.setTimeout(() => el.remove(), 220)
  }
  el.querySelector<HTMLButtonElement>('.sanz-toast-close')!.onclick = close
  layer.appendChild(el)
  requestAnimationFrame(() => el.classList.add('is-visible'))
  window.setTimeout(close, 4200)
}

export function confirmAction(message: string, options?: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean }) {
  return new Promise<boolean>((resolve) => {
    const layer = ensureLayer()
    const backdrop = document.createElement('div')
    backdrop.className = 'sanz-confirm-backdrop'
    const dialog = document.createElement('div')
    dialog.className = 'sanz-confirm-dialog'
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.innerHTML = `
      <div class="sanz-confirm-head"><div class="sanz-confirm-icon">!</div><div class="sanz-confirm-copy"><h3>${options?.title || 'Konfirmasi tindakan'}</h3><p></p></div></div>
      <div class="sanz-confirm-actions">
        <button type="button" class="sanz-confirm-cancel">${options?.cancelText || 'Batal'}</button>
        <button type="button" class="sanz-confirm-ok${options?.danger ? ' is-danger' : ''}">${options?.confirmText || 'Ya, lanjutkan'}</button>
      </div>`
    dialog.querySelector('p')!.textContent = message
    backdrop.appendChild(dialog); layer.appendChild(backdrop)
    let finished = false
    const finish = (value: boolean) => {
      if (finished) return; finished = true
      document.removeEventListener('keydown', onKey)
      backdrop.classList.remove('is-visible')
      window.setTimeout(() => backdrop.remove(), 180)
      resolve(value)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(false) }
    dialog.querySelector<HTMLButtonElement>('.sanz-confirm-cancel')!.onclick = () => finish(false)
    dialog.querySelector<HTMLButtonElement>('.sanz-confirm-ok')!.onclick = () => finish(true)
    backdrop.onclick = (event) => { if (event.target === backdrop) finish(false) }
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => { backdrop.classList.add('is-visible'); dialog.querySelector<HTMLButtonElement>('.sanz-confirm-ok')?.focus() })
  })
}
