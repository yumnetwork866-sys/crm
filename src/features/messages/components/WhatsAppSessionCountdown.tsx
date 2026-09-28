import type { MessageThread } from '../types';
import { useWhatsAppSessionWindow } from '../hooks/useWhatsAppSessionWindow';

interface WhatsAppSessionCountdownProps {
  activeThread: MessageThread | null;
}

export function WhatsAppSessionCountdown({ activeThread }: WhatsAppSessionCountdownProps) {
  const session24hInfo = useWhatsAppSessionWindow(activeThread);

  if (!session24hInfo) return null;

  return (
    <div
      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 select-none shadow-2xs ${
        session24hInfo.isExpired
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : session24hInfo.hours < 2
            ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
            : session24hInfo.hours < 12
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-emerald-50 text-emerald-600 border-emerald-300'
      }`}
      title={`Cửa sổ 24h phản hồi miễn phí Meta WhatsApp Business. ${
        session24hInfo.isExpired
          ? 'Đã hết hạn 24h - Cần gửi Template có phí để tiếp tục nhắn tin'
          : `Hết hạn lúc ${session24hInfo.expiresAt}. Nhắn tin tự do không mất phí template.`
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          session24hInfo.isExpired
            ? 'bg-rose-500'
            : session24hInfo.hours < 2
              ? 'bg-rose-500 animate-ping'
              : session24hInfo.hours < 12
                ? 'bg-amber-500'
                : 'bg-emerald-500'
        }`}
      />
      <span>{session24hInfo.formattedTime}</span>
    </div>
  );
}
