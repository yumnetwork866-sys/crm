import React from 'react';
import { Download, ExternalLink, FileSpreadsheet, FileText } from 'lucide-react';
import { renderFormattedMessage } from '../../../utils/formatMessageText';
import { MessageDeliveryStatusIcon } from '../../../components/Messages/MessageDeliveryStatusIcon';
import type { MessageDeliveryStatus } from '../../../types';

interface DocumentMessageCardProps {
  docUrl: string | null;
  filename: string;
  filesize?: number | null;
  caption?: string | null;
  timeFormatted: string;
  isAgent?: boolean;
  status?: MessageDeliveryStatus;
  isRealSent?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  fileExt?: string;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DocumentMessageCard: React.FC<DocumentMessageCardProps> = ({
  docUrl,
  filename,
  filesize,
  caption,
  timeFormatted,
  isAgent = false,
  status,
  isRealSent,
  errorMessage,
  onRetry,
  fileExt,
}) => {
  const ext = (fileExt || filename.split('.').pop() || 'PDF').toUpperCase();
  const isPdf = ext === 'PDF';
  const isSpreadsheet = ['XLS', 'XLSX', 'CSV'].includes(ext);
  const isWord = ['DOC', 'DOCX'].includes(ext);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!docUrl) return;

    if (docUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = docUrl;
      a.download = filename || `document.${ext.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(docUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full min-w-[260px] max-w-[340px] select-none py-0.5">
      {/* WhatsApp Document Card Header */}
      <div
        onClick={handleDownload}
        className={`p-3 rounded-xl border flex items-center gap-3 transition cursor-pointer shadow-2xs group ${
          isPdf
            ? 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/70'
            : isSpreadsheet
            ? 'bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/70'
            : isWord
            ? 'bg-blue-50/70 border-blue-200/80 hover:bg-blue-100/70'
            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
        }`}
        title={`Click để mở / tải về: ${filename}`}
      >
        {/* Document Icon with Extension Badge */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-xs font-mono font-bold text-[10px] uppercase text-white ${
            isPdf
              ? 'bg-rose-600'
              : isSpreadsheet
              ? 'bg-emerald-600'
              : isWord
              ? 'bg-blue-600'
              : 'bg-slate-700'
          }`}
        >
          {isSpreadsheet ? (
            <FileSpreadsheet className="w-5 h-5 text-white" />
          ) : (
            <FileText className="w-5 h-5 text-white" />
          )}
        </div>

        {/* File Name & Meta */}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-800 truncate group-hover:text-blue-700 transition" title={filename}>
            {filename}
          </p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-sans">
            <span className="font-semibold uppercase text-slate-600">{ext}</span>
            {filesize ? <span>• {formatBytes(filesize)}</span> : null}
          </p>
        </div>

        {/* Download / Open Action Icon */}
        <div className="w-8 h-8 rounded-full bg-white/90 border border-slate-200/80 text-slate-600 group-hover:text-[#1fa855] group-hover:border-[#1fa855]/40 flex items-center justify-center shrink-0 shadow-2xs transition">
          {docUrl?.startsWith('http') && !docUrl.includes('localhost') ? (
            <ExternalLink className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Caption if provided */}
      {caption && (
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111b21] font-normal pt-1.5 pl-0.5">
          {renderFormattedMessage(caption)}
        </div>
      )}

      {/* Timestamp and delivery ticks */}
      <div className="flex justify-end items-center gap-1 text-[11px] text-[#667781] mt-1 select-none">
        <span>{timeFormatted}</span>
        {isAgent && (
          <MessageDeliveryStatusIcon
            status={status}
            isRealSent={isRealSent}
            errorMessage={errorMessage}
            onRetry={onRetry}
          />
        )}
      </div>
    </div>
  );
};
