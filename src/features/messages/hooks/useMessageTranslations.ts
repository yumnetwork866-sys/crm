import { useCallback, useRef, useState } from 'react';
import type { CentralMessage } from '../../../types';
import { api } from '../../../utils/apiClient';
import { canTranslateMessage, getTranslatableMessageText } from '../utils/messageTranslation';

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

const MAX_CONCURRENT_TRANSLATIONS = 2;

export function useMessageTranslations() {
  const [translations, setTranslations] = useState<Record<string, MessageTranslationState>>({});
  const translationsRef = useRef(translations);
  translationsRef.current = translations;

  const inFlightIdsRef = useRef(new Set<string>());
  const queueRef = useRef<CentralMessage[]>([]);
  const activeWorkersRef = useRef(0);
  const requestVersionsRef = useRef<Record<string, number>>({});

  const processNextInQueue = useCallback(() => {
    while (activeWorkersRef.current < MAX_CONCURRENT_TRANSLATIONS && queueRef.current.length > 0) {
      const message = queueRef.current.shift()!;
      const text = getTranslatableMessageText(message);
      if (!text) {
        inFlightIdsRef.current.delete(message.id);
        continue;
      }

      activeWorkersRef.current += 1;
      const requestVersion = (requestVersionsRef.current[message.id] || 0) + 1;
      requestVersionsRef.current[message.id] = requestVersion;

      void api
        .post<TranslateMessageResponse>('/meta/messages/translate', {
          messageId: message.id,
          text,
          targetLanguage: 'vi',
        })
        .then((response) => {
          if (requestVersionsRef.current[message.id] !== requestVersion) return;
          if (response.alreadyTargetLanguage) {
            setTranslations((prev) => ({
              ...prev,
              [message.id]: { isLoading: false, isVisible: true, notice: 'Tin nhắn đã là tiếng Việt.' },
            }));
          } else if (response.translation) {
            message.translatedContent = response.translation;
            message.translatedLanguage = 'vi';
            setTranslations((prev) => ({
              ...prev,
              [message.id]: { text: response.translation, isLoading: false, isVisible: true },
            }));
          }
        })
        .catch((error) => {
          if (requestVersionsRef.current[message.id] !== requestVersion) return;
          setTranslations((prev) => ({
            ...prev,
            [message.id]: {
              isLoading: false,
              isVisible: true,
              error: error instanceof Error ? error.message : 'Không thể dịch tin nhắn.',
            },
          }));
        })
        .finally(() => {
          inFlightIdsRef.current.delete(message.id);
          activeWorkersRef.current -= 1;
          processNextInQueue();
        });
    }
  }, []);

  const translateMessages = useCallback((messages: CentralMessage[]) => {
    const toQueue: CentralMessage[] = [];
    const pendingUpdates: Record<string, MessageTranslationState> = {};

    messages.forEach((msg) => {
      if (msg.translatedContent) {
        if (!translationsRef.current[msg.id]?.text) {
          pendingUpdates[msg.id] = {
            text: msg.translatedContent,
            isLoading: false,
            isVisible: true,
          };
        }
        return;
      }

      if (!canTranslateMessage(msg)) return;
      if (inFlightIdsRef.current.has(msg.id)) return;
      if (translationsRef.current[msg.id]?.text) return;

      inFlightIdsRef.current.add(msg.id);
      pendingUpdates[msg.id] = { isLoading: true, isVisible: true };
      toQueue.push(msg);
    });

    if (Object.keys(pendingUpdates).length > 0) {
      setTranslations((prev) => ({ ...prev, ...pendingUpdates }));
    }

    if (toQueue.length > 0) {
      // Translate latest messages first
      const sortedQueue = [...toQueue].reverse();
      queueRef.current.push(...sortedQueue);
      processNextInQueue();
    }
  }, [processNextInQueue]);

  const translateMessage = useCallback(async (message: CentralMessage) => {
    translateMessages([message]);
  }, [translateMessages]);

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

  return { translations, toggleTranslation, translateMessage, translateMessages };
}
