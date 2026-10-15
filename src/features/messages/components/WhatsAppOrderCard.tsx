import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  PackageCheck,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../utils/apiClient';
import type { WhatsAppOrderInfo } from '../utils/messageContent';

interface CrmOrderSummary {
  id: string;
  orderCode: string;
  status: string;
}

interface ProductMatch {
  retailerId: string;
  name: string;
  imageUrl?: string | null;
}

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currency || 'MYR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('vi-VN')} ${currency}`.trim();
  }
};

export function WhatsAppOrderCard({
  messageId,
  orderInfo,
  timeFormatted,
}: {
  messageId: string;
  orderInfo: WhatsAppOrderInfo;
  timeFormatted: string;
}) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionError, setActionError] = useState('');
  const orderQuery = useQuery({
    queryKey: ['whatsapp-order', messageId],
    queryFn: () => api.get<{ order: CrmOrderSummary | null; productMatches: ProductMatch[] }>(
      `/orders/whatsapp/${encodeURIComponent(messageId)}`,
    ),
    retry: false,
  });
  const createMutation = useMutation({
    mutationFn: () => api.post<CrmOrderSummary>(
      `/orders/whatsapp/${encodeURIComponent(messageId)}`,
    ),
    onSuccess: (order) => {
      setActionError('');
      queryClient.setQueryData<{ order: CrmOrderSummary | null; productMatches: ProductMatch[] }>(
        ['whatsapp-order', messageId],
        (current) => ({ order, productMatches: current?.productMatches || [] }),
      );
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const existingOrder = orderQuery.data?.order;
  const productByRetailerId = new Map(
    (orderQuery.data?.productMatches || []).map((product) => [product.retailerId, product]),
  );
  const unmatchedCount = orderQuery.isSuccess
    ? orderInfo.items.filter((item) => !productByRetailerId.has(item.retailerId)).length
    : 0;
  const total = orderInfo.items.reduce(
    (sum, item) => sum + item.quantity * item.itemPrice,
    0,
  );
  const currency = orderInfo.items.find((item) => item.currency)?.currency || 'MYR';
  const totalQuantity = orderInfo.items.reduce((sum, item) => sum + item.quantity, 0);
  const firstProduct = productByRetailerId.get(orderInfo.items[0]?.retailerId || '');

  const confirmOrder = () => {
    const confirmed = window.confirm(
      `Tạo đơn CRM từ giỏ hàng WhatsApp gồm ${orderInfo.items.length} dòng sản phẩm?`,
    );
    if (confirmed) createMutation.mutate();
  };

  return (
    <div className="w-80 max-w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-2xs">
      <div className="flex min-h-18 bg-slate-50">
        <div className="m-2 flex w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
          {firstProduct?.imageUrl ? (
            <img
              src={firstProduct.imageUrl}
              alt={firstProduct.name}
              className="h-full w-full object-contain p-1.5"
            />
          ) : (
            <ShoppingCart className="h-7 w-7 text-emerald-600" />
          )}
        </div>
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <p className="flex items-center gap-1 text-[13px] font-bold text-slate-900">
            <ShoppingCart className="h-4 w-4 text-emerald-600" />
            {totalQuantity} sản phẩm
          </p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-600">
            {currency} {total.toFixed(2)}
          </p>
        </div>
        <ChevronDown className="mr-2 mt-2.5 h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <div className="flex items-center justify-end border-t border-slate-100 px-2.5 py-1 text-[10px] text-slate-400">
        {timeFormatted}
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-3 py-3 text-[13px] font-semibold text-emerald-600 transition hover:bg-emerald-50"
      >
        {isExpanded ? 'Ẩn giỏ hàng' : 'Xem giỏ hàng'}
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 bg-white text-slate-800">
          <div className="divide-y divide-slate-100 px-3">
            {orderInfo.items.map((item, index) => (
              <div key={`${item.retailerId}-${index}`} className="py-2">
                <div className="flex items-start justify-between gap-2">
                  {productByRetailerId.get(item.retailerId)?.imageUrl && (
                    <img
                      src={productByRetailerId.get(item.retailerId)?.imageUrl || ''}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">
                      {productByRetailerId.get(item.retailerId)?.name || item.retailerId}
                    </p>
                    {productByRetailerId.has(item.retailerId) && (
                      <p className="truncate font-mono text-[9px] text-slate-400">{item.retailerId}</p>
                    )}
                    <p className="text-[10px] text-slate-500">Số lượng: {item.quantity}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold">
                    {formatMoney(item.itemPrice * item.quantity, item.currency || currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5">
            {unmatchedCount > 0 && (
              <div className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{unmatchedCount} sản phẩm chưa đồng bộ với CRM.</span>
              </div>
            )}

            {existingOrder ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-800">
                <PackageCheck className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">{existingOrder.orderCode}</p>
                  <p>Trạng thái: {existingOrder.status}</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={confirmOrder}
                disabled={createMutation.isPending || orderQuery.isLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <CheckCircle2 className="h-3.5 w-3.5" />}
                Tạo đơn CRM
              </button>
            )}

            {(actionError || orderQuery.error) && (
              <div className="mt-2 flex items-start gap-1.5 text-[10px] text-rose-600">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{actionError || (orderQuery.error as Error)?.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
