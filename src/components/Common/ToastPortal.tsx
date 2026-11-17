import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ToastPortal({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let viewport = document.getElementById('toast-viewport');
    if (!viewport) {
      viewport = document.createElement('div');
      viewport.id = 'toast-viewport';
      viewport.className =
        'pointer-events-none fixed bottom-6 right-6 z-[100] flex max-h-[calc(100dvh-3rem)] w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto sm:w-92';
      document.body.appendChild(viewport);
    }
    setContainer(viewport);
  }, []);
  return container ? createPortal(children, container) : null;
}
