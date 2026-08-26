import { memo, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { WhatsAppTemplateButtonType } from '../../../../../types';
import { TEMPLATE_BUTTON_ICON_CLASSES } from '../../constants/templateConstants';
import { useClickOutside } from '../../hooks/useClickOutside';

type AddButtonDropdownProps = {
  onAdd: (type: WhatsAppTemplateButtonType) => void;
  disabled?: boolean;
};

const ADD_BUTTON_OPTIONS: Array<{
  type: WhatsAppTemplateButtonType;
  label: string;
  iconClass: string;
}> = [
  { type: 'QUICK_REPLY', label: 'Custom', iconClass: TEMPLATE_BUTTON_ICON_CLASSES.QUICK_REPLY },
  { type: 'URL', label: 'Visit website', iconClass: TEMPLATE_BUTTON_ICON_CLASSES.URL },
  { type: 'VOICE_CALL', label: 'Call on WhatsApp', iconClass: TEMPLATE_BUTTON_ICON_CLASSES.VOICE_CALL },
  { type: 'PHONE_NUMBER', label: 'Call Phone Number', iconClass: TEMPLATE_BUTTON_ICON_CLASSES.PHONE_NUMBER },
  { type: 'FLOW', label: 'Complete flow', iconClass: TEMPLATE_BUTTON_ICON_CLASSES.FLOW },
  { type: 'COPY_CODE', label: 'Copy offer code', iconClass: TEMPLATE_BUTTON_ICON_CLASSES.COPY_CODE },
  { type: 'CONTACT', label: 'Share contact info', iconClass: TEMPLATE_BUTTON_ICON_CLASSES.CONTACT },
];

export const AddButtonDropdown = memo(function AddButtonDropdown({
  onAdd,
  disabled = false,
}: AddButtonDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const generatedId = useId();
  const triggerId = `${generatedId}-trigger`;
  const menuId = `${generatedId}-menu`;

  const restoreTriggerFocus = () => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    restoreTriggerFocus();
  };

  useClickOutside(containerRef, () => setIsOpen(false), {
    enabled: isOpen,
    onEscape: closeAndRestoreFocus,
  });

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => itemRefs.current[highlightedIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  const openAt = (index: number) => {
    if (disabled) return;
    const nextIndex = Math.min(Math.max(index, 0), ADD_BUTTON_OPTIONS.length - 1);
    setHighlightedIndex(nextIndex);
    setIsOpen(true);
  };

  const focusItem = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), ADD_BUTTON_OPTIONS.length - 1);
    setHighlightedIndex(nextIndex);
    itemRefs.current[nextIndex]?.focus();
  };

  const addButton = (index: number) => {
    const option = ADD_BUTTON_OPTIONS[index];
    triggerRef.current?.focus();
    onAdd(option.type);
    setIsOpen(false);
    restoreTriggerFocus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'Home':
        event.preventDefault();
        openAt(0);
        break;
      case 'ArrowUp':
      case 'End':
        event.preventDefault();
        openAt(ADD_BUTTON_OPTIONS.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen) closeAndRestoreFocus();
        else openAt(0);
        break;
      default:
        break;
    }
  };

  const handleItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(index === ADD_BUTTON_OPTIONS.length - 1 ? 0 : index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(index === 0 ? ADD_BUTTON_OPTIONS.length - 1 : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(ADD_BUTTON_OPTIONS.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        addButton(index);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isOpen) setIsOpen(false);
          else openAt(0);
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>＋ Thêm button</span>
        <svg
          aria-hidden="true"
          className={`h-2 w-2 fill-slate-600 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 10 6"
        >
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="absolute bottom-full left-0 z-30 mb-1.5 min-w-47.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {ADD_BUTTON_OPTIONS.map((item, index) => {
            const isWhatsApp = item.type === 'VOICE_CALL';
            return (
              <button
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                key={item.type}
                type="button"
                role="menuitem"
                tabIndex={index === highlightedIndex ? 0 : -1}
                onFocus={() => setHighlightedIndex(index)}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
                onClick={() => addButton(index)}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900 focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex ${
                    isWhatsApp ? 'h-5 w-5' : 'h-4 w-4'
                  } shrink-0 items-center justify-center text-slate-500`}
                >
                  <i
                    className={`${item.iconClass} block ${isWhatsApp ? 'text-[18px]' : 'text-[15px]'} leading-none`}
                  />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

export default AddButtonDropdown;
