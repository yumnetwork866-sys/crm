import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WhatsAppTemplateHeaderFormat } from '../../../../types';
import { api } from '../../../../utils/apiClient';

export interface MediaFormPatch {
  mediaHandle?: string;
  mediaFileName?: string;
  mediaPreviewUrl?: string;
}

interface UseMediaUploadOptions {
  headerFormat: WhatsAppTemplateHeaderFormat;
  mediaPreviewUrl: string;
  onFormChange: (patch: MediaFormPatch) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không thể đọc file media.'));
    reader.readAsDataURL(file);
  });
}

export function useMediaUpload({ headerFormat, mediaPreviewUrl, onFormChange }: UseMediaUploadOptions) {
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');

  useEffect(() => () => {
    if (mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }
  }, [mediaPreviewUrl]);

  const mediaAccept = useMemo(() => (
    headerFormat === 'IMAGE'
      ? 'image/jpeg,image/png'
      : headerFormat === 'VIDEO'
        ? 'video/mp4'
        : 'application/pdf'
  ), [headerFormat]);

  const clearMediaError = useCallback(() => setMediaError(''), []);

  const uploadMedia = useCallback(async (file?: File) => {
    if (!file) return;

    setMediaError('');
    const maxSizeBytes = headerFormat === 'IMAGE' ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
    const maxSizeLabel = headerFormat === 'IMAGE' ? '5 MB' : '16 MB';
    if (file.size > maxSizeBytes) {
      const mediaKind = headerFormat === 'IMAGE' ? 'ảnh' : headerFormat === 'VIDEO' ? 'video' : 'tài liệu';
      setMediaError(`File mẫu ${mediaKind} không được vượt quá ${maxSizeLabel}.`);
      return;
    }

    const nextPreviewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    onFormChange({
      mediaHandle: '',
      mediaFileName: file.name,
      mediaPreviewUrl: nextPreviewUrl,
    });
    setIsUploadingMedia(true);

    try {
      const dataBase64 = await fileToBase64(file);
      const result = await api.post<{ handle: string }>('/campaigns/templates/media', {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });
      onFormChange({ mediaHandle: result.handle });
    } catch (uploadError) {
      setMediaError(uploadError instanceof Error ? uploadError.message : 'Không thể upload file mẫu.');
    } finally {
      setIsUploadingMedia(false);
    }
  }, [headerFormat, onFormChange]);

  return {
    clearMediaError,
    isUploadingMedia,
    mediaAccept,
    mediaError,
    setMediaError,
    uploadMedia,
  };
}
