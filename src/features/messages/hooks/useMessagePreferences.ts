import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationStatus, InternalNote } from '../types';
import { api } from '../../../utils/apiClient';
import { queryKeys } from '../../../lib/queryClient';
import { realtimeClient } from '../../../services/realtimeClient';

const SOUND_STORAGE_KEY = 'yumcrm_sound_enabled';
const LEGACY_SHARED_STORAGE_KEYS = [
  'yumcrm_internal_notes',
  'yumcrm_thread_statuses',
  'yumcrm_pinned_threads',
] as const;

interface MessagePreferences {
  threadStatuses: Record<string, ConversationStatus>;
  pinnedThreadIds: string[];
  autoTranslateThreadIds: string[];
}

interface ThreadStateEvent {
  businessPhoneNumberId: string;
  threadId: string;
  status: ConversationStatus;
  isPinned: boolean;
  autoTranslate: boolean;
}

const EMPTY_PREFERENCES: MessagePreferences = {
  threadStatuses: {},
  pinnedThreadIds: [],
  autoTranslateThreadIds: [],
};

function readLegacyJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getLegacyPreferences() {
  const hasLegacyData = LEGACY_SHARED_STORAGE_KEYS.some(
    (key) => localStorage.getItem(key) !== null,
  );
  if (!hasLegacyData) return null;
  return {
    threadStatuses: readLegacyJson<Record<string, ConversationStatus>>(
      'yumcrm_thread_statuses',
      {},
    ),
    pinnedThreadIds: readLegacyJson<string[]>('yumcrm_pinned_threads', []),
    internalNotes: readLegacyJson<Record<string, InternalNote[]>>('yumcrm_internal_notes', {}),
  };
}

export function useMessagePreferences(businessPhoneNumberId: string) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.messagePreferences(businessPhoneNumberId),
    [businessPhoneNumberId],
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_STORAGE_KEY) !== 'false',
  );

  const preferencesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const endpoint = `/meta/messages/preferences?phoneNumberId=${encodeURIComponent(businessPhoneNumberId)}`;
      const databasePreferences = await api.get<MessagePreferences>(endpoint);
      const legacyPreferences = getLegacyPreferences();
      if (!legacyPreferences) return databasePreferences;

      try {
        await api.post('/meta/messages/preferences/import', {
          businessPhoneNumberId,
          ...legacyPreferences,
        });
        LEGACY_SHARED_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
        void queryClient.invalidateQueries({ queryKey: queryKeys.customers });
        return await api.get<MessagePreferences>(endpoint);
      } catch (error) {
        console.warn('[MESSAGE PREFERENCES] Chưa thể nhập dữ liệu localStorage cũ:', error);
        return databasePreferences;
      }
    },
    enabled: Boolean(businessPhoneNumberId),
  });
  const preferences = preferencesQuery.data ?? EMPTY_PREFERENCES;

  const setPreferences = useCallback(
    (update: (current: MessagePreferences) => MessagePreferences) => {
      queryClient.setQueryData<MessagePreferences>(queryKey, (current) =>
        update(current ?? EMPTY_PREFERENCES),
      );
    },
    [queryClient, queryKey],
  );

  const threadMutation = useMutation({
    mutationFn: (input: { threadId: string; status?: ConversationStatus; isPinned?: boolean; autoTranslate?: boolean }) =>
      api.patch<ThreadStateEvent>('/meta/messages/preferences/thread', {
        businessPhoneNumberId,
        ...input,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MessagePreferences>(queryKey);
      setPreferences((current) => ({
        ...current,
        threadStatuses:
          input.status === undefined
            ? current.threadStatuses
            : { ...current.threadStatuses, [input.threadId]: input.status },
        pinnedThreadIds:
          input.isPinned === undefined
            ? current.pinnedThreadIds
            : input.isPinned
              ? Array.from(new Set([...current.pinnedThreadIds, input.threadId]))
              : current.pinnedThreadIds.filter((id) => id !== input.threadId),
        autoTranslateThreadIds:
          input.autoTranslate === undefined
            ? current.autoTranslateThreadIds
            : input.autoTranslate
              ? Array.from(new Set([...current.autoTranslateThreadIds, input.threadId]))
              : current.autoTranslateThreadIds.filter((id) => id !== input.threadId),
      }));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (state) => {
      setPreferences((current) => ({
        ...current,
        threadStatuses: { ...current.threadStatuses, [state.threadId]: state.status },
        pinnedThreadIds: state.isPinned
          ? Array.from(new Set([...current.pinnedThreadIds, state.threadId]))
          : current.pinnedThreadIds.filter((id) => id !== state.threadId),
        autoTranslateThreadIds: state.autoTranslate
          ? Array.from(new Set([...current.autoTranslateThreadIds, state.threadId]))
          : current.autoTranslateThreadIds.filter((id) => id !== state.threadId),
      }));
    },
  });

  useEffect(() => {
    if (!businessPhoneNumberId) return;
    return realtimeClient.subscribe({
      'message:preferences:thread': (event) => {
        try {
          const state = JSON.parse(event.data) as ThreadStateEvent;
          if (state.businessPhoneNumberId !== businessPhoneNumberId) return;
          setPreferences((current) => ({
            ...current,
            threadStatuses: { ...current.threadStatuses, [state.threadId]: state.status },
            pinnedThreadIds: state.isPinned
              ? Array.from(new Set([...current.pinnedThreadIds, state.threadId]))
              : current.pinnedThreadIds.filter((id) => id !== state.threadId),
            autoTranslateThreadIds: state.autoTranslate
              ? Array.from(new Set([...current.autoTranslateThreadIds, state.threadId]))
              : current.autoTranslateThreadIds.filter((id) => id !== state.threadId),
          }));
        } catch {
          // Ignore malformed realtime events.
        }
      },
      'message:preferences:sync': (event) => {
        try {
          const payload = JSON.parse(event.data) as { businessPhoneNumberId: string };
          if (payload.businessPhoneNumberId === businessPhoneNumberId) {
            void queryClient.invalidateQueries({ queryKey });
          }
        } catch {
          // Ignore malformed realtime events.
        }
      },
    });
  }, [businessPhoneNumberId, queryClient, queryKey, setPreferences]);

  const updateSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
    } catch {
      // Sound still works for the current session.
    }
  }, []);

  const togglePinThread = useCallback(
    (threadId: string) => {
      threadMutation.mutate({
        threadId,
        isPinned: !preferences.pinnedThreadIds.includes(threadId),
      });
    },
    [preferences.pinnedThreadIds, threadMutation],
  );

  const updateThreadStatus = useCallback(
    (threadId: string, status: ConversationStatus) => {
      threadMutation.mutate({ threadId, status });
    },
    [threadMutation],
  );

  const toggleAutoTranslate = useCallback(
    (threadId: string) => {
      threadMutation.mutate({
        threadId,
        autoTranslate: !preferences.autoTranslateThreadIds.includes(threadId),
      });
    },
    [preferences.autoTranslateThreadIds, threadMutation],
  );

  return {
    soundEnabled,
    setSoundEnabled: updateSoundEnabled,
    threadStatuses: preferences.threadStatuses,
    pinnedThreadIds: preferences.pinnedThreadIds,
    autoTranslateThreadIds: preferences.autoTranslateThreadIds,
    togglePinThread,
    updateThreadStatus,
    toggleAutoTranslate,
  };
}
