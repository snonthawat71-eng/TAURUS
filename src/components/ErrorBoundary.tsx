import { Component, type ErrorInfo, type ReactNode } from 'react'
import { IconAlertTriangle, IconRefresh, IconTrash } from '@tabler/icons-react'

/**
 * The last line of defence. Without one, a single render error unmounts the
 * whole tree and the user is left staring at a white page with nothing to go
 * on — which is exactly what happened, and why this exists.
 *
 * It shows what broke and offers the two things that actually fix it: a
 * reload, and a reload that throws away the service worker and its caches
 * (a half-updated app shell looks identical to a code bug from the outside).
 */
interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // the stack is the only thing that makes a report actionable
    console.error('[TAURUS] render error', error, info.componentStack)
  }

  async hardReload() {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? []
      await Promise.all(regs.map((r) => r.unregister()))
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch { /* nothing to clear */ }
    location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-dvh grid place-items-center bg-canvas px-5">
        <div className="card p-6 max-w-[420px] w-full text-center">
          <IconAlertTriangle size={26} className="mx-auto text-[#D85A30]" />
          <p className="text-[14px] font-medium mt-3">หน้านี้มีปัญหา</p>
          <p className="text-[12px] text-ink-2 mt-1 leading-relaxed break-words">{error.message}</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => location.reload()} className="btn-primary flex-1 h-10 inline-flex items-center justify-center gap-1.5">
              <IconRefresh size={15} /> โหลดใหม่
            </button>
            <button onClick={() => void this.hardReload()}
              className="flex-1 h-10 rounded-md bg-surface-2 text-ink-2 text-[13px] font-medium inline-flex items-center justify-center gap-1.5">
              <IconTrash size={15} /> ล้างแคช
            </button>
          </div>
        </div>
      </div>
    )
  }
}
