import React, { useEffect, useRef, useState } from 'react';
import { Bot, Camera, Loader2, Save, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/apiClient';
import { queryKeys } from '../../lib/queryClient';
import { useAiProfile, type AiProfile } from '../../features/messages/hooks/useAiProfile';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

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

export const AiManagementPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const profileQuery = useAiProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
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
      setSuccess('Đã cập nhật tên AI.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật tên AI.');
    } finally {
      setIsSaving(false);
    }
  };

  const profile = profileQuery.data;

  return (
    <section className="rounded-3xl border border-slate-300 bg-white p-5 shadow-lg sm:p-6">
      <div className="border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-black text-slate-950 sm:text-lg">Trợ lý AI</h2>
        </div>
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
                onClick={() => inputRef.current?.click()}
                disabled={isSaving}
                className="relative isolate flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 p-0 text-slate-500 outline-none transition hover:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-wait disabled:opacity-70"
                title={profile?.avatarUrl ? 'Thay ảnh đại diện' : 'Tải ảnh đại diện'}
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
              {profile?.avatarUrl && !isSaving && (
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
              <label htmlFor="ai-name" className="block text-sm font-black text-slate-800">Tên hiển thị</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="ai-name"
                  value={name}
                  maxLength={80}
                  disabled={isSaving}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void saveName();
                  }}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={isSaving || !name.trim() || name.trim() === profile?.name}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-extrabold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu tên
                </button>
              </div>
            </div>

            {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
            {success && <p className="mt-3 text-xs font-bold text-emerald-700">{success}</p>}

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
