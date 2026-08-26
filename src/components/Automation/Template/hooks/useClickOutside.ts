import { useEffect, useRef, type RefObject } from 'react';

type UseClickOutsideOptions = {
  enabled?: boolean;
  onEscape?: (event: KeyboardEvent) => void;
};

export function useClickOutside<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  onPointerDownOutside: (event: PointerEvent) => void,
  { enabled = true, onEscape }: UseClickOutsideOptions = {},
) {
  const outsideHandlerRef = useRef(onPointerDownOutside);
  const escapeHandlerRef = useRef(onEscape);

  outsideHandlerRef.current = onPointerDownOutside;
  escapeHandlerRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const path = event.composedPath();
      if (path.includes(container)) return;

      outsideHandlerRef.current(event);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !escapeHandlerRef.current) return;

      event.stopPropagation();
      escapeHandlerRef.current(event);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, enabled]);
}
