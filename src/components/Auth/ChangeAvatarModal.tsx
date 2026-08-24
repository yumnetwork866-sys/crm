import React, { useRef, useState } from 'react';
import { Camera, Check, Dices, Loader2, ShieldCheck, Upload, X, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ChangeAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  'https://api.dicebear.com/10.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/10.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/10.x/adventurer/svg?seed=Oliver',
  'https://api.dicebear.com/10.x/adventurer/svg?seed=Zoe',
];

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
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar || AVATAR_PRESETS[0]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    const generated = `https://api.dicebear.com/10.x/adventurer/svg?seed=${randomSeed}`;
    setSelectedAvatar(generated);
    setUploadedFileName(null);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden text-white">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Đổi Ảnh Đại Diện</h2>
            <p className="text-xs text-slate-400">Tải ảnh từ máy tính hoặc chọn mẫu cho {currentUser.name}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-5">
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
            {uploadedFileName ? (
              <div className="flex items-center gap-1.5 mt-2 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700 text-[11px] text-indigo-300">
                <span className="truncate max-w-[200px]">{uploadedFileName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFileName(null);
                    setSelectedAvatar(currentUser.avatar || AVATAR_PRESETS[0]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-slate-400 hover:text-rose-400 ml-1"
                  title="Hủy ảnh này"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-2">Xem trước ảnh đại diện</p>
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

          {/* Presets List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">Hoặc chọn ảnh mẫu có sẵn</label>
              <button
                type="button"
                onClick={handleRandomAvatar}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>Tạo ngẫu nhiên</span>
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2 bg-slate-800/50 p-2.5 rounded-2xl border border-slate-700/60">
              {AVATAR_PRESETS.map((preset, idx) => {
                const isSelected = selectedAvatar === preset && !uploadedFileName;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(preset);
                      setUploadedFileName(null);
                    }}
                    className={`relative rounded-full aspect-square overflow-hidden border-2 transition transform hover:scale-105 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-400 ring-2 ring-indigo-500 shadow-md'
                        : 'border-transparent hover:border-slate-500 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={preset} alt="" className="w-full h-full object-cover bg-slate-700" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
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
};
