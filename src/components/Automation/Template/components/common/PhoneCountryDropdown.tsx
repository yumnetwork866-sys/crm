import { ChevronDown } from 'lucide-react';
import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { PHONE_COUNTRIES } from '../../../../../data/phoneCountries';
import { inputClass } from '../../constants/templateConstants';
import { useClickOutside } from '../../hooks/useClickOutside';

type PhoneCountryDropdownProps = {
  value: string;
  onChange: (countryIso: string) => void;
};

export const PhoneCountryDropdown = memo(function PhoneCountryDropdown({
  value,
  onChange,
}: PhoneCountryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const generatedId = useId();
  const triggerId = `${generatedId}-trigger`;
  const listboxId = `${generatedId}-listbox`;
  const selectedCountry =
    PHONE_COUNTRIES.find(([iso]) => iso === value) ?? PHONE_COUNTRIES.find(([iso]) => iso === 'VN');
  const normalizedSearch = search.trim().toUpperCase();
  const filteredCountries = normalizedSearch
    ? PHONE_COUNTRIES.filter(([iso, dialCode]) => `${iso} ${dialCode}`.includes(normalizedSearch))
    : PHONE_COUNTRIES;
  const activeCountry = filteredCountries[highlightedIndex];
  const activeOptionId = activeCountry ? `${generatedId}-option-${activeCountry[0]}` : undefined;

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
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const openDropdown = (preferredIndex?: number) => {
    setSearch('');
    const selectedIndex = PHONE_COUNTRIES.findIndex(([iso]) => iso === value);
    setHighlightedIndex(
      preferredIndex ?? (selectedIndex >= 0 ? selectedIndex : 0),
    );
    setIsOpen(true);
  };

  const moveHighlight = (nextIndex: number) => {
    if (filteredCountries.length === 0) return;
    setHighlightedIndex(Math.min(Math.max(nextIndex, 0), filteredCountries.length - 1));
  };

  const selectCountry = (index: number) => {
    const country = filteredCountries[index];
    if (!country) return;
    onChange(country[0]);
    closeAndRestoreFocus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen) closeAndRestoreFocus();
        else openDropdown();
        break;
      case 'ArrowUp':
      case 'End':
        event.preventDefault();
        openDropdown(PHONE_COUNTRIES.length - 1);
        break;
      case 'Home':
        event.preventDefault();
        openDropdown(0);
        break;
      default:
        break;
    }
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveHighlight(highlightedIndex === filteredCountries.length - 1 ? 0 : highlightedIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveHighlight(highlightedIndex <= 0 ? filteredCountries.length - 1 : highlightedIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveHighlight(0);
        break;
      case 'End':
        event.preventDefault();
        moveHighlight(filteredCountries.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        selectCountry(highlightedIndex);
        break;
      default:
        break;
    }
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = index === filteredCountries.length - 1 ? 0 : index + 1;
        moveHighlight(nextIndex);
        optionRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const nextIndex = index === 0 ? filteredCountries.length - 1 : index - 1;
        moveHighlight(nextIndex);
        optionRefs.current[nextIndex]?.focus();
        break;
      }
      case 'Home':
        event.preventDefault();
        moveHighlight(0);
        optionRefs.current[0]?.focus();
        break;
      case 'End': {
        event.preventDefault();
        const lastIndex = filteredCountries.length - 1;
        moveHighlight(lastIndex);
        optionRefs.current[lastIndex]?.focus();
        break;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectCountry(index);
        break;
      default:
        break;
    }
  };

  const selectedCountryText = selectedCountry ? `${selectedCountry[0]} ${selectedCountry[1]}` : 'Chọn mã';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        onClick={() => {
          if (isOpen) setIsOpen(false);
          else openDropdown();
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-label={`Quốc gia: ${selectedCountryText}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`${inputClass} flex h-10 cursor-pointer items-center justify-between gap-2 py-0 text-left`}
      >
        <span>{selectedCountryText}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 p-2">
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => {
                const nextSearch = event.target.value;
                const nextNormalizedSearch = nextSearch.trim().toUpperCase();
                const nextFilteredCountries = nextNormalizedSearch
                  ? PHONE_COUNTRIES.filter(([iso, dialCode]) =>
                      `${iso} ${dialCode}`.includes(nextNormalizedSearch),
                    )
                  : PHONE_COUNTRIES;
                const selectedIndex = nextFilteredCountries.findIndex(([iso]) => iso === value);

                setSearch(nextSearch);
                setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
              }}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-label="Tìm mã quốc gia"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              placeholder="Tìm mã..."
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div id={listboxId} role="listbox" aria-label="Mã quốc gia" className="max-h-44 overflow-y-auto py-1">
            {filteredCountries.length ? (
              filteredCountries.map(([iso, dialCode], index) => (
                <button
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  id={`${generatedId}-option-${iso}`}
                  key={iso}
                  type="button"
                  role="option"
                  aria-selected={iso === value}
                  tabIndex={-1}
                  onMouseMove={() => setHighlightedIndex(index)}
                  onFocus={() => setHighlightedIndex(index)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  onClick={() => selectCountry(index)}
                  className={`flex h-8 w-full cursor-pointer items-center gap-2 px-3 text-xs transition focus:outline-none ${
                    iso === value || index === highlightedIndex
                      ? 'bg-indigo-50 font-bold text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      iso === value ? 'border-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {iso === value ? <span className="h-2 w-2 rounded-full bg-indigo-600" /> : null}
                  </span>
                  <span>{iso}</span>
                  <span className="ml-auto font-mono text-slate-500">{dialCode}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-center text-xs text-slate-500">Không tìm thấy mã phù hợp.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default PhoneCountryDropdown;
