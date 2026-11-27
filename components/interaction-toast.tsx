'use client'

import { useEffect } from 'react'
import { AlertCircle, Check, Info, TriangleAlert, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'warning' | 'info'

type InteractionToastProps = {
  message: string
  kind?: ToastKind
  onDismiss: () => void
  duration?: number
}

const styles: Record<ToastKind, { icon: typeof Check; className: string }> = {
  success: { icon: Check, className: 'border-emerald-200 bg-white text-emerald-800' },
  error: { icon: AlertCircle, className: 'border-red-200 bg-white text-red-800' },
  warning: { icon: TriangleAlert, className: 'border-amber-200 bg-white text-amber-900' },
  info: { icon: Info, className: 'border-blue-200 bg-white text-blue-900' },
}

export function InteractionToast({ message, kind = 'info', onDismiss, duration = 3200 }: InteractionToastProps) {
  const { icon: Icon, className } = styles[kind]

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timeout)
  }, [duration, message, onDismiss])

  return (
    <div role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'} className={`interaction-toast fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.16)] ${className}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-black/[0.05]"><Icon size={17} aria-hidden="true" /></span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-5">{message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-black/[0.06]"><X size={16} aria-hidden="true" /></button>
    </div>
  )
}
