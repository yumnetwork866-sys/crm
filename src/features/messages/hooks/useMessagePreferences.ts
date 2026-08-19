import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ConversationStatus, InternalNote } from '../types';

const STORAGE_KEYS = {
  sound: 'yumcrm_sound_enabled',
  notes: 'yumcrm_internal_notes',
  statuses: 'yumcrm_thread_statuses',
  pinnedThreads: 'yumcrm_pinned_threads',
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}

function persistJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // UI preferences are non-critical when browser storage is unavailable.
  }
}

function usePersistedState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readJson(key, initialValue));
  const setPersistedValue: Dispatch<SetStateAction<T>> = useCallback((update) => {
    setValue((previous) => {
      const next = typeof update === 'function'
        ? (update as (current: T) => T)(previous)
        : update;
      persistJson(key, next);
      return next;
    });
  }, [key]);
  return [value, setPersistedValue];
}

export function useMessagePreferences() {
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(STORAGE_KEYS.sound) !== 'false');
  const [internalNotes, setInternalNotes] = usePersistedState<Record<string, InternalNote[]>>(STORAGE_KEYS.notes, {});
  const [threadStatuses, setThreadStatuses] = usePersistedState<Record<string, ConversationStatus>>(STORAGE_KEYS.statuses, {});
  const [pinnedThreadIds, setPinnedThreadIds] = usePersistedState<string[]>(STORAGE_KEYS.pinnedThreads, []);

  const updateSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem(STORAGE_KEYS.sound, String(enabled));
    } catch {
      // Sound still works for the current session.
    }
  }, []);

  const togglePinThread = useCallback((threadId: string) => {
    setPinnedThreadIds((current) => current.includes(threadId)
      ? current.filter((id) => id !== threadId)
      : [...current, threadId]);
  }, [setPinnedThreadIds]);

  const updateThreadStatus = useCallback((threadId: string, status: ConversationStatus) => {
    setThreadStatuses((current) => ({ ...current, [threadId]: status }));
  }, [setThreadStatuses]);

  const addInternalNote = useCallback((customerId: string, note: InternalNote) => {
    setInternalNotes((current) => ({
      ...current,
      [customerId]: [note, ...(current[customerId] || [])],
    }));
  }, [setInternalNotes]);

  const deleteInternalNote = useCallback((customerId: string, noteId: string) => {
    setInternalNotes((current) => ({
      ...current,
      [customerId]: (current[customerId] || []).filter((note) => note.id !== noteId),
    }));
  }, [setInternalNotes]);

  return {
    soundEnabled,
    setSoundEnabled: updateSoundEnabled,
    internalNotes,
    threadStatuses,
    pinnedThreadIds,
    togglePinThread,
    updateThreadStatus,
    addInternalNote,
    deleteInternalNote,
  };
}
