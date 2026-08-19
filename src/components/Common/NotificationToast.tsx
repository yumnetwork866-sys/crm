import React, { useEffect } from 'react';
import { MessageSquare, X, ArrowRight, BellRing } from 'lucide-react';
import type { CentralMessage } from '../../types';

interface NotificationToastProps {
  toast: {
    message: CentralMessage;
    show: boolean;
  } | null;
  onClose: () => void;
  onOpenMessage: (message: CentralMessage) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  toast,
  onClose,
  onOpenMessage,
}) => {
  useEffect(() => {
    if (toast?.show) {
      const timer = setTimeout(() => {
        onClose();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast || !toast.show) return null;

  const { message } = toast;

  const getChannelBg = (channel: string) => {
    switch (channel) {
      case 'WhatsApp':
        return 'bg-emerald-500 text-white';
      case 'Zalo':
        return 'bg-blue-600 text-white';
      case 'Facebook':
        return 'bg-indigo-600 text-white';
      case 'TikTok':
        return 'bg-black text-white';
      default:
        return 'bg-indigo-500 text-white';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="relative shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-100 truncate">{message.customerName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500 text-white">
                WhatsApp
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
              "{message.content}"
            </p>

            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <BellRing className="w-3 h-3 text-amber-400" />
                Vừa xong • {message.customerPhone}
              </span>
              <button
                onClick={() => {
                  onOpenMessage(message);
                  onClose();
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 cursor-pointer transition"
              >
                <span>Xem tin nhắn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
