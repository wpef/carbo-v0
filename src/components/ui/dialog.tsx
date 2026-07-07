'use client'

// Minimal controlled dialog (base-ui has no shadcn-style Dialog export in this project).
// Supports both `onOpenChange(open)` and `onClose()` callers.
import * as React from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  children: React.ReactNode
}

export function Dialog({ open = true, onOpenChange, onClose, children }: DialogProps) {
  const close = React.useCallback(() => {
    onOpenChange?.(false)
    onClose?.()
  }, [onOpenChange, onClose])

  // Échap ferme le dialog (attendu d'un modal, avec le clic sur le fond).
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-auto"
      >
        {children}
      </div>
    </div>
  )
}

export function DialogContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
  /** Accepted for API compatibility with shadcn-style callers; the close affordance is the backdrop + footer buttons. */
  showCloseButton?: boolean
}) {
  return <div className={cn('rounded-lg border bg-background p-6 shadow-lg', className)}>{children}</div>
}

export function DialogHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mb-4 space-y-1', className)}>{children}</div>
}

export function DialogTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)}>{children}</div>
}
