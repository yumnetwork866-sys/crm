import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, ShieldCheck, Upload, X, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ChangeAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

const processImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chọn file hình ảnh (JPG, PNG, WEBP, GIF).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Center crop to square
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Không thể tải file ảnh.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Đọc file thất bại.'));
    reader.readAsDataURL(file);
  });
};

export const ChangeAvatarModal: React.FC<ChangeAvatarModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, changeAvatar } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar || DEFAULT_AVATAR);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && currentUser?.avatar) {
      setSelectedAvatar(currentUser.avatar);
      setUploadedFileName(null);
    }
  }, [isOpen, currentUser?.avatar]);

  if (!isOpen || !currentUser) return null;

  const handleFileSelect = async (file: File) => {
    setError('');
    try {
      const dataUrl = await processImageFile(file);
      setSelectedAvatar(dataUrl);
      setUploadedFileName(file.name);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi xử lý ảnh tải lên.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAvatar) {
      setError('Vui lòng chọn hoặc tải lên ảnh đại diện.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await changeAvatar(selectedAvatar);
      setSuccess('Cập nhật ảnh đại diện thành công!');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Không thể cập nhật ảnh đại diện.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess('');
    setUploadedFileName(null);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-avatar-title"
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-white my-auto max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 pr-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <h2 id="change-avatar-title" className="text-base font-bold text-white">Đổi Ảnh Đại Diện</h2>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{success}</span>
              </div>
            )}

            {/* Current Avatar Preview */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="relative group">
                <img
                  src={selectedAvatar}
                  alt="Avatar preview"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-indigo-500/30 border-2 border-indigo-400 shadow-xl bg-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white shadow-md border-2 border-slate-900 transition cursor-pointer"
                  title="Tải ảnh mới từ thiết bị"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
              {uploadedFileName && (
                <div className="flex items-center gap-1.5 mt-2 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700 text-[11px] text-indigo-300">
                  <span className="truncate max-w-50">{uploadedFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFileName(null);
                      setSelectedAvatar(currentUser.avatar || DEFAULT_AVATAR);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                    title="Hủy ảnh này"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={handleInputChange}
              className="hidden"
            />

            {/* Upload Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tải ảnh lên từ thiết bị
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10'
                    : 'border-slate-700 hover:border-indigo-500/70 bg-slate-800/40 hover:bg-slate-800/70'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-xs font-medium text-slate-200">
                  <span className="text-indigo-400 font-bold hover:underline">Nhấp để chọn file ảnh</span> hoặc kéo thả vào đây
                </div>
                <p className="text-[10px] text-slate-400">Hỗ trợ JPG, PNG, WEBP, GIF (Tự động căn chỉnh &amp; tối ưu kích thước)</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 sm:px-6 sm:py-4 flex items-center justify-end gap-2.5 border-t border-slate-800 shrink-0 bg-slate-900/90 backdrop-blur-sm">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading || Boolean(success)}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Lưu ảnh đại diện</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
