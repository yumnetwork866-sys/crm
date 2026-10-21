import React, { useEffect, useRef, useState } from 'react';
import { Bot, Camera, Check, Loader2, Pencil, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/apiClient';
import { queryKeys } from '../../lib/queryClient';
import { useAiProfile, type AiProfile } from '../../features/messages/hooks/useAiProfile';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

interface AiManagementPanelProps {
  canEdit?: boolean;
  isAiEnabled?: boolean;
  isLoadingAi?: boolean;
  isSavingAi?: boolean;
  canManageAi?: boolean;
  onToggleAi?: () => void;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'));
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      reject(new Error('Ảnh đại diện không được vượt quá 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

export const AiManagementPanel: React.FC<AiManagementPanelProps> = ({
  canEdit = true,
  isAiEnabled = false,
  isLoadingAi = false,
  isSavingAi = false,
  canManageAi = true,
  onToggleAi,
}) => {
  const queryClient = useQueryClient();
  const profileQuery = useAiProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profileQuery.data?.name) setName(profileQuery.data.name);
  }, [profileQuery.data?.name]);

  const saveProfile = async (updates: Partial<Pick<AiProfile, 'name' | 'avatarUrl'>>) => {
    const profile = await api.put<AiProfile>('/ai-profile', updates);
    queryClient.setQueryData(queryKeys.aiProfile, profile);
    return profile;
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const imageBase64 = await readImage(file);
      const upload = await api.post<{ url: string }>('/upload', {
        imageBase64,
        folder: 'ai',
        customFilename: 'ai-avatar',
      });
      await saveProfile({ avatarUrl: upload.url });
      setSuccess('Đã cập nhật ảnh đại diện AI.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không thể cập nhật ảnh đại diện AI.');
    } finally {
      setIsSaving(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      await saveProfile({ avatarUrl: null });
      setSuccess('Đã xóa ảnh đại diện AI.');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Không thể xóa ảnh đại diện AI.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveName = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Tên AI không được để trống.');
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const profile = await saveProfile({ name: normalizedName });
      setName(profile.name);
      setIsEditingName(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật tên AI.');
    } finally {
      setIsSaving(false);
    }
  };

  const profile = profileQuery.data;

  return (
    <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-black text-slate-950 sm:text-lg">AI Trả Lời Tin Nhắn</h2>
        </div>

        {onToggleAi && (
          <button
            type="button"
            role="switch"
            aria-checked={isAiEnabled}
            aria-label={`${isAiEnabled ? 'Tắt' : 'Bật'} AI trả lời toàn hệ thống`}
            onClick={onToggleAi}
            disabled={!canManageAi || isLoadingAi || isSavingAi}
            title={canManageAi ? (isAiEnabled ? 'AI đang hoạt động - Bấm để tắt' : 'AI đang tắt - Bấm để bật') : 'Bạn không có quyền thay đổi trạng thái AI'}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
              isAiEnabled ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-200'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                isAiEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            >
              {(isLoadingAi || isSavingAi) && (
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
              )}
            </span>
          </button>
        )}
      </div>

      {profileQuery.isPending ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-bold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải hồ sơ AI...
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="group relative h-24 w-24 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (canEdit) inputRef.current?.click();
                }}
                disabled={isSaving || !canEdit}
                className="relative isolate flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 p-0 text-slate-500 outline-none transition hover:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-wait disabled:opacity-70"
                title={canEdit ? (profile?.avatarUrl ? 'Thay ảnh đại diện' : 'Tải ảnh đại diện') : 'Bạn không có quyền chỉnh sửa hồ sơ AI'}
              >
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} className="absolute inset-0 z-0 block h-full w-full object-cover" />
                ) : (
                  <Bot className="relative z-0 h-9 w-9" />
                )}
                <span className={`pointer-events-none absolute inset-0 z-10 flex h-full w-full items-center justify-center rounded-full bg-indigo-950/30 text-white backdrop-blur-[1px] transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin drop-shadow" /> : <Camera className="h-5 w-5 drop-shadow" />}
                </span>
              </button>
              {profile?.avatarUrl && !isSaving && canEdit && (
                <button
                  type="button"
                  onClick={() => void removeAvatar()}
                  className="absolute -right-1 -top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 opacity-0 shadow-md transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                  title="Xóa ảnh đại diện"
                  aria-label="Xóa ảnh đại diện"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="max-w-lg">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={editInputRef}
                    id="ai-name"
                    aria-label="Tên trợ lý AI"
                    value={name}
                    maxLength={80}
                    disabled={isSaving}
                    placeholder="Nhập tên trợ lý AI..."
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void saveName();
                      if (event.key === 'Escape') {
                        setName(profile?.name || '');
                        setIsEditingName(false);
                      }
                    }}
                    className="h-9 min-w-0 flex-1 rounded-xl border border-indigo-500 bg-white px-3 text-sm font-bold text-slate-900 outline-none ring-2 ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    disabled={isSaving || !name.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer shadow-xs disabled:opacity-40"
                    title="Lưu tên"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setName(profile?.name || '');
                      setIsEditingName(false);
                      setError('');
                    }}
                    disabled={isSaving}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                    title="Hủy"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-black text-slate-900">
                    {name || profile?.name || 'Yum Assistant'}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(true);
                        setTimeout(() => editInputRef.current?.focus(), 50);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                      title="Chỉnh sửa tên AI"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
            {success && <p className="mt-3 text-xs font-bold text-emerald-700">{success}</p>}
            {!canEdit && <p className="mt-3 text-xs font-bold text-amber-700">Bạn chỉ có quyền xem hồ sơ trợ lý AI.</p>}

            {/* Live Preview Box */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Xem trước</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-indigo-200 bg-indigo-100 flex items-center justify-center shadow-xs">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={name || 'AI'} className="h-full w-full object-cover" />
                  ) : (
                    <Bot className="h-5 w-5 text-indigo-600" />
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                </div>
                <div className="min-w-0 max-w-sm rounded-2xl rounded-tl-xs bg-white p-3.5 shadow-sm border border-slate-200/90 text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-black text-slate-900 truncate">
                      {name.trim() || profile?.name || 'Yum Assistant'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-700">
                      BOT AI
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-slate-700">
                    Xin chào! Em có thể hỗ trợ gì cho anh/chị ạ?
                  </p>
                  <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                    <span>10:45</span>
                    <span className="text-indigo-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </section>
  );
};
