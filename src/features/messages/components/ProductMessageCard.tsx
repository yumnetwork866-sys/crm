import React from 'react';
import { Package } from 'lucide-react';
import { renderFormattedMessage } from '../../../utils/formatMessageText';
import { MessageDeliveryStatusIcon } from '../../../components/Messages/MessageDeliveryStatusIcon';
import type { MessageDeliveryStatus } from '../../../types';
import type { ProductMessageInfo } from '../utils/messageContent';

interface ProductMessageCardProps {
  productInfo: ProductMessageInfo;
  timeFormatted: string;
  isAgent?: boolean;
  status?: MessageDeliveryStatus;
  isRealSent?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

function formatPrice(price?: string | number, currency?: string): string {
  if (price === undefined || price === null || price === '') return '';
  if (typeof price === 'string' && /[a-z]/i.test(price)) return price;
  const num = Number(price);
  if (!Number.isFinite(num)) return String(price);
  const amount = num / 100;
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency || 'VND'}`;
}

export const ProductMessageCard: React.FC<ProductMessageCardProps> = ({
  productInfo,
  timeFormatted,
  isAgent = false,
  status,
  isRealSent,
  errorMessage,
  onRetry,
}) => {
  const priceDisplay = formatPrice(productInfo.price, productInfo.currency);

  return (
    <div className="w-full max-w-[280px] sm:max-w-[320px] rounded-xl overflow-hidden bg-white border border-slate-200/90 shadow-2xs">
      {/* Product Image Header */}
      <div className="relative aspect-4/3 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
        {productInfo.imageUrl ? (
          <img
            src={productInfo.imageUrl}
            alt={productInfo.name}
            className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-300">
            <Package className="w-12 h-12 stroke-[1.25]" />
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Sản phẩm</span>
          </div>
        )}
      </div>

      {/* Product Content Details */}
      <div className="p-3 space-y-1.5">
        <h4 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">
          {productInfo.name}
        </h4>

        {priceDisplay && (
          <div className="text-[13px] font-extrabold text-emerald-600">
            {priceDisplay}
          </div>
        )}

        <div className="text-[10px] font-mono text-slate-400">
          Mã SP: {productInfo.retailerId}
        </div>

        {productInfo.caption && (
          <div className="pt-1 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed border-t border-slate-100 mt-1.5">
            {renderFormattedMessage(productInfo.caption)}
          </div>
        )}

        {/* Timestamp & Status */}
        <div className="flex items-center justify-end gap-1 pt-1 text-[11px] text-[#667781] select-none font-normal">
          <span>{timeFormatted}</span>
          {isAgent && (
            <MessageDeliveryStatusIcon
              status={status}
              isRealSent={isRealSent}
              errorMessage={errorMessage}
              onRetry={onRetry}
            />
          )}
        </div>
      </div>
    </div>
  );
};
