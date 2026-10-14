import type { ConversationStatus } from './types';

export const STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; emoji: string; bg: string; text: string; border: string; dot: string }
> = {
  consulting: { label: 'Đang tư vấn', emoji: '💬', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  ordered: { label: 'Đã chốt đơn', emoji: '📦', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  callback: { label: 'Hẹn gọi lại', emoji: '📞', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  completed: { label: 'Hoàn thành', emoji: '✅', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
};
