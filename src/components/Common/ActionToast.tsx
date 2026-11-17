import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { ToastPortal } from './ToastPortal';

export function ActionToast({
  message,
  variant = 'success',
  onClose,
}: {
  message: string;
  variant?: 'success' | 'error';
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!message || paused) return;
    const timer = window.setTimeout(() => closeRef.current(), variant === 'error' ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [message, paused, variant]);
  if (!message) return null;
  const Icon = variant === 'error' ? CircleAlert : CheckCircle2;
  return (
    <ToastPortal>
      <div
        role={variant === 'error' ? 'alert' : 'status'}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="pointer-events-auto flex shrink-0 items-start gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5"
      >
        <Icon
          className={`mt-0.5 h-5 w-5 shrink-0 ${variant === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}
        />
        <p className="min-w-0 flex-1 break-words text-sm leading-6 text-slate-700">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </ToastPortal>
  );
}
