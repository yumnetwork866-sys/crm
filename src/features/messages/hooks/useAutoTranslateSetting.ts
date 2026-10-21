import { useCallback, useEffect, useState } from 'react';

export const AUTO_TRANSLATE_STORAGE_KEY = 'yumcrm_auto_translate_enabled';

export function getAutoTranslateSetting(): boolean {
  try {
    const value = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
    return value !== 'false';
  } catch {
    return true;
  }
}

export function setAutoTranslateSetting(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_TRANSLATE_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(
      new CustomEvent('auto_translate:status_change', { detail: { enabled } }),
    );
  } catch (error) {
    console.error('Failed to save auto translate setting', error);
  }
}

export function useAutoTranslateSetting() {
  const [isAutoTranslateEnabled, setIsAutoTranslateEnabled] = useState(getAutoTranslateSetting);

  useEffect(() => {
    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === 'boolean') {
        setIsAutoTranslateEnabled(detail.enabled);
      }
    };
    window.addEventListener('auto_translate:status_change', handleStatusChange);
    return () => {
      window.removeEventListener('auto_translate:status_change', handleStatusChange);
    };
  }, []);

  const toggleAutoTranslate = useCallback(() => {
    const next = !isAutoTranslateEnabled;
    setIsAutoTranslateEnabled(next);
    setAutoTranslateSetting(next);
  }, [isAutoTranslateEnabled]);

  return { isAutoTranslateEnabled, setAutoTranslate: setAutoTranslateSetting, toggleAutoTranslate };
}
