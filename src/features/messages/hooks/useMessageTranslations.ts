import { useCallback, useRef, useState } from 'react';
import type { CentralMessage } from '../../../types';
import { api } from '../../../utils/apiClient';
import { getTranslatableMessageText } from '../utils/messageTranslation';

interface TranslateMessageResponse {
  translation?: string;
  alreadyTargetLanguage?: boolean;
}

export interface MessageTranslationState {
  text?: string;
  isLoading: boolean;
  isVisible: boolean;
  error?: string;
  notice?: string;
}

export function useMessageTranslations() {
  const [translations, setTranslations] = useState<Record<string, MessageTranslationState>>({});
  const translationsRef = useRef(translations);
  translationsRef.current = translations;
  const requestVersionsRef = useRef<Record<string, number>>({});

  const translateMessage = useCallback(async (message: CentralMessage, show = true) => {
    const current = translationsRef.current[message.id];
    if (current?.isLoading) return;
    const persistedText = current?.text || message.translatedContent || undefined;
    if (persistedText) {
      setTranslations((previous) => ({
        ...previous,
        [message.id]: { text: persistedText, isLoading: false, isVisible: show },
      }));
      return;
    }
    const text = getTranslatableMessageText(message);
    if (!text) return;

    const requestVersion = (requestVersionsRef.current[message.id] || 0) + 1;
    requestVersionsRef.current[message.id] = requestVersion;
    setTranslations((previous) => ({
      ...previous,
      [message.id]: { isLoading: true, isVisible: true },
    }));

    try {
      const response = await api.post<TranslateMessageResponse>('/meta/messages/translate', {
        messageId: message.id,
        text,
        targetLanguage: 'vi',
      });
      if (requestVersionsRef.current[message.id] !== requestVersion) return;
      setTranslations((previous) => ({
        ...previous,
        [message.id]: response.alreadyTargetLanguage
          ? { isLoading: false, isVisible: true, notice: 'Tin nhắn đã là tiếng Việt.' }
          : { text: response.translation, isLoading: false, isVisible: true },
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

  const toggleTranslation = useCallback(async (message: CentralMessage) => {
    const current = translationsRef.current[message.id];
    const persistedText = current?.text || message.translatedContent || undefined;
    if (current?.isLoading) return;
    if (persistedText) {
      setTranslations((previous) => ({
        ...previous,
        [message.id]: {
          text: persistedText,
          isLoading: false,
          isVisible: !(previous[message.id]?.isVisible ?? false),
        },
      }));
      return;
    }
    await translateMessage(message);
  }, [translateMessage]);

  return { translations, toggleTranslation, translateMessage };
}
