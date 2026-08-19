import { X } from 'lucide-react';

interface MessageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function MessageLightbox({ imageUrl, onClose }: MessageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn cursor-zoom-out"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
        title="Đóng"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={imageUrl}
        alt="Ảnh tin nhắn toàn màn hình"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
