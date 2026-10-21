import React, { useEffect, useState } from 'react';
import {
  Bot,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AiManagementPanel } from '../UserManagement/AiManagementPanel';
import { useAuth } from '../../contexts/AuthContext';
import { Permission } from '../../lib/permissions';
import { api } from '../../utils/apiClient';
import { useAutoTranslateSetting } from '../../features/messages/hooks/useAutoTranslateSetting';

interface AiStatusResponse {
  isAiEnabled: boolean;
}

export const AiManagementView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageAi = hasPermission(Permission.MESSAGES_MANAGE);
  const canManageProfile = hasPermission(Permission.USERS_MANAGE);
  const { isAutoTranslateEnabled, toggleAutoTranslate } = useAutoTranslateSetting();
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void api.get<AiStatusResponse>('/meta/ai-status')
      .then((response) => {
        if (!cancelled) setIsAiEnabled(response.isAiEnabled);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải trạng thái AI.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.scope === 'global' && typeof detail.isAiEnabled === 'boolean') {
        setIsAiEnabled(detail.isAiEnabled);
      }
    };
    window.addEventListener('ai:status_change', handleStatusChange);
    return () => {
      cancelled = true;
      window.removeEventListener('ai:status_change', handleStatusChange);
    };
  }, []);

  const toggleGlobalAi = async () => {
    if (!canManageAi || isLoading || isSaving) return;
    const previous = isAiEnabled;
    const enabled = !previous;
    setIsAiEnabled(enabled);
    setIsSaving(true);
    setError('');
    try {
      const response = await api.post<AiStatusResponse>('/meta/ai-toggle', { enabled });
      setIsAiEnabled(response.isAiEnabled);
    } catch (saveError) {
      setIsAiEnabled(previous);
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật trạng thái AI.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {/* Main Configuration Grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        {/* Unified AI Management Card */}
        <AiManagementPanel
          canEdit={canManageProfile}
          isAiEnabled={isAiEnabled}
          isLoadingAi={isLoading}
          isSavingAi={isSaving}
          canManageAi={canManageAi}
          onToggleAi={() => void toggleGlobalAi()}
        />

        {/* Translation & Multi-language Center */}
        <section className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-950 sm:text-lg">AI Dịch tin nhắn</h2>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isAutoTranslateEnabled}
                aria-label={`${isAutoTranslateEnabled ? 'Tắt' : 'Bật'} tự động dịch tin nhắn`}
                onClick={toggleAutoTranslate}
                title={isAutoTranslateEnabled ? 'Đang bật tự động dịch - Bấm để tắt' : 'Đang tắt tự động dịch - Bấm để bật'}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer ${
                  isAutoTranslateEnabled ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-200'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                    isAutoTranslateEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <dl className="mt-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                <dt className="font-bold text-slate-500">Model</dt>
                <dd className="font-black text-slate-900">translategemma:12b</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                <dt className="font-bold text-slate-500">Ngôn ngữ đích</dt>
                <dd className="font-black text-slate-900">Tiếng Việt</dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            onClick={() => void navigate('/messages')}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 shadow-sm cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            Mở WhatsApp
          </button>
        </section>
      </div>

      {!canManageAi && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          <Bot className="h-4 w-4 shrink-0" />
          Bạn có quyền xem cấu hình AI nhưng cần quyền quản lý tin nhắn để thay đổi trạng thái toàn hệ thống.
        </div>
      )}
    </div>
  );
};
