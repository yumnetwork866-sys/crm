import { ChevronDown } from 'lucide-react';
import { memo, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { inputClass } from '../../constants/templateConstants';
import { useClickOutside } from '../../hooks/useClickOutside';

type CircleOptionDropdownProps = {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel?: string;
};

const clampIndex = (index: number, optionCount: number) => {
  if (optionCount === 0) return -1;
  return Math.min(Math.max(index, 0), optionCount - 1);
};

export const CircleOptionDropdown = memo(function CircleOptionDropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: CircleOptionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const generatedId = useId();
  const triggerId = `${generatedId}-trigger`;
  const listboxId = `${generatedId}-listbox`;
  const selectedOption = options[selectedIndex] ?? options[0];

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

    const nextIndex = clampIndex(highlightedIndex, options.length);
    const frame = window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const openAt = (index: number) => {
    setHighlightedIndex(clampIndex(index, options.length));
    setIsOpen(true);
  };

  const focusOption = (index: number) => {
    const nextIndex = clampIndex(index, options.length);
    if (nextIndex < 0) return;
    setHighlightedIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        openAt(selectedIndex);
        break;
      case 'ArrowUp':
        event.preventDefault();
        openAt(options.length - 1);
        break;
      case 'Home':
        event.preventDefault();
        openAt(0);
        break;
      case 'End':
        event.preventDefault();
        openAt(options.length - 1);
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
        focusOption(index === options.length - 1 ? 0 : index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(index === 0 ? options.length - 1 : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onChange(options[index].value);
        closeAndRestoreFocus();
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
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
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`${inputClass} flex h-10 cursor-pointer items-center justify-between gap-2 py-0 text-left`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute left-0 top-full z-50 mt-1 max-h-56 min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={index === highlightedIndex ? 0 : -1}
                onFocus={() => setHighlightedIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => {
                  onChange(option.value);
                  closeAndRestoreFocus();
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition focus:outline-none ${
                  isSelected
                    ? 'bg-indigo-50 font-semibold text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isSelected ? 'border-indigo-600' : 'border-slate-300'
                  }`}
                >
                  {isSelected ? <span className="h-2 w-2 rounded-full bg-indigo-600" /> : null}
                </span>
                <span className="whitespace-nowrap">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

export default CircleOptionDropdown;
