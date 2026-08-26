import { Ban, Check, ChevronDown, FileText, Image, MapPin, Video, type LucideIcon } from 'lucide-react';
import { memo, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { WhatsAppTemplateHeaderFormat } from '../../../../../types';
import { inputClass, MEDIA_SAMPLE_OPTIONS } from '../../constants/templateConstants';
import { useClickOutside } from '../../hooks/useClickOutside';

type MediaSampleDropdownProps = {
  value: WhatsAppTemplateHeaderFormat;
  onChange: (value: WhatsAppTemplateHeaderFormat) => void;
  labelClass: string;
};

const MEDIA_SAMPLE_ICONS: Record<(typeof MEDIA_SAMPLE_OPTIONS)[number]['value'], LucideIcon> = {
  NONE: Ban,
  IMAGE: Image,
  VIDEO: Video,
  DOCUMENT: FileText,
  LOCATION: MapPin,
};

export const MediaSampleDropdown = memo(function MediaSampleDropdown({
  value,
  onChange,
  labelClass,
}: MediaSampleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const generatedId = useId();
  const triggerId = `${generatedId}-trigger`;
  const listboxId = `${generatedId}-listbox`;
  const selectedFormat = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(value) ? value : 'NONE';
  const selectedIndex = Math.max(
    0,
    MEDIA_SAMPLE_OPTIONS.findIndex((item) => item.value === selectedFormat),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const selectedOption = MEDIA_SAMPLE_OPTIONS[selectedIndex] ?? MEDIA_SAMPLE_OPTIONS[0];
  const SelectedIcon = MEDIA_SAMPLE_ICONS[selectedOption.value];

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
    const frame = window.requestAnimationFrame(() => optionRefs.current[highlightedIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const openAt = (index: number) => {
    setHighlightedIndex(Math.min(Math.max(index, 0), MEDIA_SAMPLE_OPTIONS.length - 1));
    setIsOpen(true);
  };

  const focusOption = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), MEDIA_SAMPLE_OPTIONS.length - 1);
    setHighlightedIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  const selectOption = (index: number) => {
    onChange(MEDIA_SAMPLE_OPTIONS[index].value);
    closeAndRestoreFocus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        openAt(selectedIndex);
        break;
      case 'ArrowUp':
        event.preventDefault();
        openAt(MEDIA_SAMPLE_OPTIONS.length - 1);
        break;
      case 'Home':
        event.preventDefault();
        openAt(0);
        break;
      case 'End':
        event.preventDefault();
        openAt(MEDIA_SAMPLE_OPTIONS.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen) closeAndRestoreFocus();
        else openAt(selectedIndex);
        break;
      default:
        break;
    }
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption(index === MEDIA_SAMPLE_OPTIONS.length - 1 ? 0 : index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(index === 0 ? MEDIA_SAMPLE_OPTIONS.length - 1 : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(MEDIA_SAMPLE_OPTIONS.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectOption(index);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative sm:max-w-56">
      <label htmlFor={triggerId} className={labelClass}>
        Media sample <span className="font-normal text-slate-400">· Optional</span>
      </label>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        onClick={() => {
          if (isOpen) setIsOpen(false);
          else openAt(selectedIndex);
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`${inputClass} mt-1 flex cursor-pointer items-center justify-between gap-2 font-medium`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <SelectedIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-600" />
          <span className="truncate">{selectedOption.label}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {MEDIA_SAMPLE_OPTIONS.map((item, index) => {
            const Icon = MEDIA_SAMPLE_ICONS[item.value];
            const isSelected = item.value === selectedFormat;
            return (
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                key={item.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={index === highlightedIndex ? 0 : -1}
                onFocus={() => setHighlightedIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => selectOption(index)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2.5 px-3 py-2 text-left text-sm transition focus:outline-none ${
                  isSelected
                    ? 'bg-indigo-50 font-semibold text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {isSelected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

export default MediaSampleDropdown;
