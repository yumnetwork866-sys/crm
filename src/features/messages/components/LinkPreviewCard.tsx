import React, { useEffect, useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { api } from '../../../utils/apiClient';

export interface LinkPreviewData {
  url: string;
  domain: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const memoryPreviewCache = new Map<string, LinkPreviewData>();

interface LinkPreviewCardProps {
  url: string;
  className?: string;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ url, className = '' }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(() => memoryPreviewCache.get(url) || null);
  const [loading, setLoading] = useState<boolean>(() => !memoryPreviewCache.has(url));
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!url) return;
    if (memoryPreviewCache.has(url)) {
      setPreview(memoryPreviewCache.get(url) || null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);

    api.get<LinkPreviewData>(`/meta/link-preview?url=${encodeURIComponent(url)}`)
      .then((data) => {
        if (!isMounted) return;
        if (data && (data.title || data.image)) {
          memoryPreviewCache.set(url, data);
          setPreview(data);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (error || (!loading && !preview)) {
    return null;
  }

  if (loading) {
    return (
      <div className={`w-full max-w-sm rounded-xl overflow-hidden border border-slate-200/80 bg-white/90 p-2.5 animate-pulse space-y-2 select-none mb-1.5 ${className}`}>
        <div className="w-full h-28 bg-slate-200/70 rounded-lg" />
        <div className="h-3 bg-slate-200/80 rounded w-3/4" />
        <div className="h-2.5 bg-slate-200/60 rounded w-1/2" />
      </div>
    );
  }

  if (!preview) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(preview.url || url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      className={`w-full max-w-sm rounded-xl overflow-hidden border border-slate-200/90 bg-white hover:bg-slate-50/90 transition shadow-2xs group cursor-pointer mb-1.5 select-none ${className}`}
      title={preview.title || preview.domain}
    >
      {/* Top Banner Image (if available) */}
      {preview.image && (
        <div className="relative w-full h-36 bg-slate-100 overflow-hidden border-b border-slate-100">
          <img
            src={preview.image}
            alt={preview.title || 'Xem trước liên kết'}
            className="w-full h-full object-cover group-hover:scale-103 transition duration-250"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-medium text-white flex items-center gap-1 shadow-2xs">
            <Globe className="w-2.5 h-2.5" />
            <span className="truncate max-w-[150px]">{preview.domain}</span>
          </div>
        </div>
      )}

      {/* Content Meta */}
      <div className="p-2.5 space-y-1">
        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#1fa855] transition line-clamp-2 leading-snug">
          {preview.title}
        </h4>

        {preview.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}

        <div className="pt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-1 truncate max-w-[200px]">
            {!preview.image && <Globe className="w-2.5 h-2.5 shrink-0" />}
            <span className="truncate">{preview.domain}</span>
          </div>
          <ExternalLink className="w-3 h-3 shrink-0 text-slate-400 group-hover:text-[#1fa855] transition" />
        </div>
      </div>
    </div>
  );
};
