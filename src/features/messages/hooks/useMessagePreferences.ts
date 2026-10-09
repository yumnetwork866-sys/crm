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
  internalNotes: Record<string, InternalNote[]>;
  threadStatuses: Record<string, ConversationStatus>;
  pinnedThreadIds: string[];
}

interface ThreadStateEvent {
  businessPhoneNumberId: string;
  threadId: string;
  status: ConversationStatus;
  isPinned: boolean;
}

const EMPTY_PREFERENCES: MessagePreferences = {
  internalNotes: {},
  threadStatuses: {},
  pinnedThreadIds: [],
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
    mutationFn: (input: { threadId: string; status?: ConversationStatus; isPinned?: boolean }) =>
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
      }));
    },
  });

  const noteMutation = useMutation({
    mutationFn: (input: { threadId: string; note: InternalNote }) =>
      api.post<InternalNote>('/meta/messages/preferences/notes', {
        businessPhoneNumberId,
        threadId: input.threadId,
        content: input.note.content,
      }),
    onMutate: async ({ threadId, note }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MessagePreferences>(queryKey);
      setPreferences((current) => ({
        ...current,
        internalNotes: {
          ...current.internalNotes,
          [threadId]: [note, ...(current.internalNotes[threadId] || [])],
        },
      }));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (savedNote, { threadId, note }) => {
      setPreferences((current) => ({
        ...current,
        internalNotes: {
          ...current.internalNotes,
          [threadId]: [
            savedNote,
            ...(current.internalNotes[threadId] || []).filter(
              (item) => item.id !== note.id && item.id !== savedNote.id,
            ),
          ],
        },
      }));
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ noteId }: { threadId: string; noteId: string }) =>
      api.delete<{ threadId: string; noteId: string }>(
        `/meta/messages/preferences/notes/${encodeURIComponent(noteId)}?phoneNumberId=${encodeURIComponent(businessPhoneNumberId)}`,
      ),
    onMutate: async ({ threadId, noteId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MessagePreferences>(queryKey);
      setPreferences((current) => ({
        ...current,
        internalNotes: {
          ...current.internalNotes,
          [threadId]: (current.internalNotes[threadId] || []).filter((note) => note.id !== noteId),
        },
      }));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
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
          }));
        } catch {
          // Ignore malformed realtime events.
        }
      },
      'message:preferences:note_created': (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            businessPhoneNumberId: string;
            note: InternalNote & { threadId: string };
          };
          if (payload.businessPhoneNumberId !== businessPhoneNumberId) return;
          const { threadId, ...note } = payload.note;
          setPreferences((current) => ({
            ...current,
            internalNotes: {
              ...current.internalNotes,
              [threadId]: [
                note,
                ...(current.internalNotes[threadId] || []).filter((item) => item.id !== note.id),
              ],
            },
          }));
        } catch {
          // Ignore malformed realtime events.
        }
      },
      'message:preferences:note_deleted': (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            businessPhoneNumberId: string;
            threadId: string;
            noteId: string;
          };
          if (payload.businessPhoneNumberId !== businessPhoneNumberId) return;
          setPreferences((current) => ({
            ...current,
            internalNotes: {
              ...current.internalNotes,
              [payload.threadId]: (current.internalNotes[payload.threadId] || []).filter(
                (note) => note.id !== payload.noteId,
              ),
            },
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

  const addInternalNote = useCallback(
    (threadId: string, note: InternalNote) => {
      noteMutation.mutate({ threadId, note });
    },
    [noteMutation],
  );

  const deleteInternalNote = useCallback(
    (threadId: string, noteId: string) => {
      deleteNoteMutation.mutate({ threadId, noteId });
    },
    [deleteNoteMutation],
  );

  return {
    soundEnabled,
    setSoundEnabled: updateSoundEnabled,
    internalNotes: preferences.internalNotes,
    threadStatuses: preferences.threadStatuses,
    pinnedThreadIds: preferences.pinnedThreadIds,
    togglePinThread,
    updateThreadStatus,
    addInternalNote,
    deleteInternalNote,
  };
}
