import React from 'react';
import { AlertCircle, Check, CheckCheck, Clock, RotateCw } from 'lucide-react';
import type { MessageDeliveryStatus } from '../../types';

interface MessageDeliveryStatusIconProps {
  status?: MessageDeliveryStatus;
  isRealSent?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

export const MessageDeliveryStatusIcon: React.FC<MessageDeliveryStatusIconProps> = ({
  status,
  isRealSent,
  errorMessage,
  onRetry,
  className = 'w-3.5 h-3.5 shrink-0 inline-block',
}) => {
  // If explicitly marked as failed, or isRealSent is false
  if (status === 'failed' || isRealSent === false) {
    const errorTooltip = errorMessage || 'Gửi tin nhắn qua Meta thất bại. Bấm để thử lại.';
    return (
      <span
        className="inline-flex items-center gap-1 group/failed cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onRetry?.();
        }}
        title={errorTooltip}
      >
        <AlertCircle className={`${className} text-rose-500 group-hover/failed:scale-110 transition`} />
        {onRetry && (
          <span className="text-[10px] text-rose-500 font-semibold underline underline-offset-1 hidden group-hover/failed:inline-flex items-center gap-0.5">
            <RotateCw className="w-2.5 h-2.5 animate-spin-reverse" /> Thử lại
          </span>
        )}
      </span>
    );
  }

  // Sending state
  if (status === 'sending') {
    return (
      <span title="Đang gửi...">
        <Clock className={`${className} text-slate-400 animate-pulse`} />
      </span>
    );
  }

  // Sent state (Single gray checkmark: Meta Cloud accepted)
  if (status === 'sent') {
    return (
      <span title="Đã gửi (Meta đã tiếp nhận)">
        <Check className={`${className} text-slate-400`} />
      </span>
    );
  }

  // Delivered state (Double gray checkmark: Recipient phone received)
  if (status === 'delivered') {
    return (
      <span title="Đã nhận (Đã tới điện thoại khách)">
        <CheckCheck className={`${className} text-slate-400`} />
      </span>
    );
  }

  // Read state or default legacy state (Double cyan checkmark: Recipient read)
  return (
    <span title="Đã xem">
      <CheckCheck className={`${className} text-[#53bdeb]`} />
    </span>
  );
};
