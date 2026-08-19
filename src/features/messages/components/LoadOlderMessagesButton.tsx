import { RefreshCw } from 'lucide-react';

interface LoadOlderMessagesButtonProps {
  visible: boolean;
  loading: boolean;
  onLoad: () => void;
}

export function LoadOlderMessagesButton({ visible, loading, onLoad }: LoadOlderMessagesButtonProps) {
  if (!visible) return null;

  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        onClick={onLoad}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Đang tải tin cũ…' : 'Tải tin nhắn cũ hơn'}
      </button>
    </div>
  );
}
