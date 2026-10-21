import { useCallback, useRef, useState } from 'react';
import type { CentralMessage } from '../../../types';
import { api } from '../../../utils/apiClient';
import { formatMessagePreview } from '../utils/messageContent';

interface TranslateMessageResponse {
  success: boolean;
  translation: string;
  targetLanguage: string;
  model: string;
}

export interface MessageTranslationState {
  text?: string;
  isLoading: boolean;
  isVisible: boolean;
  error?: string;
}

export function useMessageTranslations() {
  const [translations, setTranslations] = useState<Record<string, MessageTranslationState>>({});
  const translationsRef = useRef(translations);
  translationsRef.current = translations;
  const requestVersionsRef = useRef<Record<string, number>>({});

  const toggleTranslation = useCallback(async (message: CentralMessage) => {
    const current = translationsRef.current[message.id];
    if (current?.isLoading) return;
    if (current?.text) {
      setTranslations((previous) => ({
        ...previous,
        [message.id]: { ...previous[message.id], isVisible: !previous[message.id].isVisible },
      }));
      return;
    }

    const text = formatMessagePreview(message.content).trim();
    if (!text) {
      setTranslations((previous) => ({
        ...previous,
        [message.id]: {
          isLoading: false,
          isVisible: true,
          error: 'Tin nhắn này không có nội dung văn bản để dịch.',
        },
      }));
      return;
    }

    const requestVersion = (requestVersionsRef.current[message.id] || 0) + 1;
    requestVersionsRef.current[message.id] = requestVersion;
    setTranslations((previous) => ({
      ...previous,
      [message.id]: { isLoading: true, isVisible: true },
    }));

    try {
      const response = await api.post<TranslateMessageResponse>('/meta/messages/translate', {
        text,
        targetLanguage: 'vi',
      });
      if (requestVersionsRef.current[message.id] !== requestVersion) return;
      setTranslations((previous) => ({
        ...previous,
        [message.id]: {
          text: response.translation,
          isLoading: false,
          isVisible: true,
        },
      }));
    } catch (error) {
      if (requestVersionsRef.current[message.id] !== requestVersion) return;
      setTranslations((previous) => ({
        ...previous,
        [message.id]: {
          isLoading: false,
          isVisible: true,
          error: error instanceof Error ? error.message : 'Không thể dịch tin nhắn.',
        },
      }));
    }
  }, []);

  return { translations, toggleTranslation };
}

