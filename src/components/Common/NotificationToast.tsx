import React, { useEffect, useMemo, useState } from 'react';
import { Camera, FileText, MessageSquare, Mic, Package, X } from 'lucide-react';
import type { CentralMessage, Customer } from '../../types';
import { isSamePhoneNumber, getCustomerAvatar } from '../../utils/crmUtils';
import { extractProductInfo, isProductContent } from '../../features/messages/utils/messageContent';

interface NotificationToastProps {
  toast: {
    message: CentralMessage;
    show: boolean;
  } | null;
  customers?: Customer[];
  onClose: () => void;
  onOpenMessage: (message: CentralMessage) => void;
}

const DISPLAY_DURATION_MS = 7000;

function parseToastMessageSnippet(content: string): {
  type: 'text' | 'image' | 'audio' | 'document' | 'product';
  text: string;
} {
  if (!content) return { type: 'text', text: 'Tin nhắn mới' };

  // Strip reply quote header if present
  const clean = content.replace(/^\[reply:\{.*?\}\]\n/, '').trim();

  if (isProductContent(clean) || /^\[product(?:_list)?(?::\s*|\s*)\{/i.test(clean)) {
    const prod = extractProductInfo(clean);
    const prodName = prod.name && prod.name !== 'Sản phẩm Catalog' ? prod.name : '';
    return {
      type: 'product',
      text: prodName ? `[Sản phẩm] ${prodName}` : 'Sản phẩm từ danh mục',
    };
  }

  if (
    clean.startsWith('data:image/') ||
    clean.startsWith('/uploads/') ||
    clean.startsWith('/api/meta/media/') ||
    clean.toLowerCase().startsWith('[hình ảnh') ||
    clean.toLowerCase().startsWith('[image')
  ) {
    const lines = clean.split('\n');
    const caption = lines.length > 1 ? lines.slice(1).join(' ').trim() : '';
    return {
      type: 'image',
      text: caption || 'Hình ảnh',
    };
  }

  if (
    clean.startsWith('data:audio/') ||
    clean.startsWith('/api/meta/media/?type=audio') ||
    clean.toLowerCase().includes('[tin nhắn thoại')
  ) {
    return {
      type: 'audio',
      text: 'Tin nhắn thoại',
    };
  }

  if (
    clean.startsWith('[document:') ||
    clean.includes('type=document') ||
    clean.toLowerCase().startsWith('[tài liệu')
  ) {
    const docMatch = clean.match(/"filename":"([^"]+)"/);
    const filename = docMatch ? docMatch[1] : '';
    return {
      type: 'document',
      text: filename || 'Tài liệu',
    };
  }

  return {
    type: 'text',
    text: clean,
  };
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  toast,
  customers,
  onClose,
  onOpenMessage,
}) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!toast?.show) {
      setProgress(100);
      setIsPaused(false);
      return;
    }

    setProgress(100);
    const stepInterval = 50;
    const stepAmount = (stepInterval / DISPLAY_DURATION_MS) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            onClose();
            return 0;
          }
          return Math.max(0, prev - stepAmount);
        });
      }
    }, stepInterval);

    return () => clearInterval(timer);
  }, [toast?.show, isPaused, onClose]);

  const matchedCustomer = useMemo(() => {
    if (!toast?.message || !customers?.length) return null;
    const msg = toast.message;
    return customers.find(
      (c) =>
        c.id === msg.customerId ||
        isSamePhoneNumber(c.phone, msg.customerPhone || msg.customerId)
    ) || null;
  }, [toast?.message, customers]);

  if (!toast || !toast.show) return null;

  const { message } = toast;
  const customerName = matchedCustomer?.name || message.customerName || 'Khách Hàng';
  const customerPhone = matchedCustomer?.phone || message.customerPhone || '';
  const fallbackAvatar = getCustomerAvatar(null, customerPhone || customerName);
  const avatarUrl = getCustomerAvatar(matchedCustomer?.avatar, customerPhone || customerName);
  const snippet = parseToastMessageSnippet(message.content);

  return (
    <div
      role="alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => {
        onOpenMessage(message);
        onClose();
      }}
      className="fixed bottom-6 right-6 z-50 w-80 sm:w-92 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-200 hover:shadow-[0_20px_50px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 cursor-pointer group animate-in fade-in slide-in-from-bottom-5 duration-200 select-none"
    >
      <div className="p-3.5 flex items-center gap-3">
        {/* Customer Avatar with WhatsApp Badge */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 ring-2 ring-emerald-500/20 shadow-xs">
            <img
              src={avatarUrl}
              alt={customerName}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
              onError={(e) => {
                e.currentTarget.src = fallbackAvatar;
              }}
            />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] text-white flex items-center justify-center ring-2 ring-white shadow-2xs">
            <MessageSquare className="w-2.5 h-2.5 fill-white/30" />
          </div>
        </div>

        {/* Content: Name + Snippet */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-700 transition">
              {customerName}
            </h4>
            <span className="text-[11px] text-slate-400 shrink-0 font-normal">
              Vừa xong
            </span>
          </div>

          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mt-0.5">
            {snippet.type === 'image' && (
              <Camera className="w-3.5 h-3.5 inline text-emerald-600 mr-1 -mt-0.5 shrink-0" />
            )}
            {snippet.type === 'audio' && (
              <Mic className="w-3.5 h-3.5 inline text-emerald-600 mr-1 -mt-0.5 shrink-0" />
            )}
            {snippet.type === 'document' && (
              <FileText className="w-3.5 h-3.5 inline text-emerald-600 mr-1 -mt-0.5 shrink-0" />
            )}
            {snippet.type === 'product' && (
              <Package className="w-3.5 h-3.5 inline text-emerald-600 mr-1 -mt-0.5 shrink-0" />
            )}
            <span>{snippet.text}</span>
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition shrink-0 cursor-pointer self-start -mr-1 -mt-1"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thin Countdown Bar */}
      <div className="h-0.5 bg-slate-100 w-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
