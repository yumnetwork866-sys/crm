import { useRef, useState } from 'react';
import { Bot, Camera, Loader2, X } from 'lucide-react';
import type { AiProfile } from '../../features/messages/hooks/useAiProfile';

interface AiManagementPanelProps {
  profile?: AiProfile;
  avatarPreview?: string | null;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  embedded?: boolean;
  onRetry: () => void;
  onChange: (profile: AiProfile) => void;
  onAvatarChange: (image: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Ảnh đại diện không được vượt quá 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

export function AiManagementPanel({
  profile,
  avatarPreview,
  disabled = false,
  loading,
  error,
  onRetry,
  onChange,
  onAvatarChange,
  onBusyChange,
  embedded = false,
}: AiManagementPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState('');
  const avatar = avatarPreview !== undefined ? avatarPreview : profile?.avatarUrl;
  const locked = disabled || reading || loading || !profile;
  const selectImage = async (file?: File) => {
    if (!file || locked) return;
    setReading(true);
    onBusyChange(true);
    setFileError('');
    try {
      onAvatarChange(await readImage(file));
    } catch (readError) {
      setFileError(readError instanceof Error ? readError.message : 'Không đọc được ảnh.');
    } finally {
      setReading(false);
      onBusyChange(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  return (
    <section
      className={
        embedded
          ? 'grid gap-5 lg:grid-cols-[160px_minmax(0,1fr)]'
          : 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5'
      }
    >
      <h2
        className={
          embedded
            ? 'pt-1 text-xs font-semibold text-slate-700'
            : 'text-sm font-semibold text-slate-900'
        }
      >
        Hồ sơ trợ lý
      </h2>
      <div className="min-w-0">
        {loading ? (
          <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải hồ sơ…
          </p>
        ) : error ? (
          <p role="alert" className="mt-4 text-xs text-rose-700">
            {error}
            <button type="button" onClick={onRetry} className="ml-2 underline">
              Thử lại
            </button>
          </p>
        ) : (
          <div className={`${embedded ? '' : 'mt-5'} flex max-w-xl items-center gap-4`}>
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={locked}
                onClick={() => inputRef.current?.click()}
                aria-label="Chọn ảnh đại diện trợ lý"
                className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 text-slate-400 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Ảnh đại diện trợ lý"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Bot className="h-7 w-7" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  {reading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </span>
              </button>
              {avatar && (
                <button
                  type="button"
                  disabled={locked}
                  aria-label="Xóa ảnh đại diện trợ lý"
                  onClick={() => onAvatarChange(null)}
                  className="absolute -right-1 -top-1 rounded-full border border-slate-200 bg-white p-1 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <label htmlFor="ai-name" className="min-w-0 flex-1 text-xs font-medium text-slate-600">
              Tên trợ lý
              <input
                id="ai-name"
                form="ai-configuration-form"
                required
                maxLength={80}
                value={profile?.name || ''}
                disabled={locked}
                onChange={(event) => profile && onChange({ ...profile, name: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-emerald-100 disabled:bg-slate-50"
              />
            </label>
          </div>
        )}
        {fileError && (
          <p role="alert" className="mt-3 text-xs text-rose-700">
            {fileError}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={locked}
          className="hidden"
          onChange={(event) => void selectImage(event.target.files?.[0])}
        />
      </div>
    </section>
  );
}
