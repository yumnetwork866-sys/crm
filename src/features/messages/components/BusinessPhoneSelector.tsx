import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { BusinessPhoneNumber } from '../types';

interface BusinessPhoneSelectorProps {
  phones: BusinessPhoneNumber[];
  selectedPhoneId: string;
  onSelect: (phoneId: string) => void;
}

function getFallbackPhoneAvatarUrl(phone: BusinessPhoneNumber): string {
  const initial = (phone.verifiedName || phone.displayPhoneNumber || 'Y').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><rect width="40" height="40" rx="20" fill="#1fa855"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getPhoneAvatarUrl(phone: BusinessPhoneNumber): string {
  return phone.profilePictureUrl || getFallbackPhoneAvatarUrl(phone);
}

function getPhoneCountryFlag(displayPhoneNumber: string): string {
  const digits = displayPhoneNumber.replace(/\D/g, '');
  const countryFlags: Array<[string, string]> = [
    ['84', '🇻🇳'],
    ['60', '🇲🇾'],
    ['62', '🇮🇩'],
    ['63', '🇵🇭'],
    ['65', '🇸🇬'],
    ['66', '🇹🇭'],
    ['61', '🇦🇺'],
    ['44', '🇬🇧'],
    ['1', '🇺🇸'],
  ];
  return countryFlags.find(([prefix]) => digits.startsWith(prefix))?.[1] || '🌐';
}

export function BusinessPhoneSelector({ phones, selectedPhoneId, onSelect }: BusinessPhoneSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const selectedPhone = phones.find((phone) => phone.id === selectedPhoneId) || phones[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  if (!selectedPhone) return null;

  return (
    <div ref={selectorRef} className="relative min-w-0 flex-1">
      <button
        id="waba-phone-select"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full min-w-0 items-center gap-2 rounded-xl border bg-white px-2 py-1.5 text-left shadow-xs transition cursor-pointer ${
          isOpen
            ? 'border-[#1fa855] ring-2 ring-[#1fa855]/15'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        }`}
        title="Chọn số doanh nghiệp gửi tin (WABA)"
      >
        <img
          src={getPhoneAvatarUrl(selectedPhone)}
          alt={`Ảnh đại diện ${selectedPhone.verifiedName}`}
          className="h-8 w-8 shrink-0 rounded-full bg-emerald-50 object-cover"
          onError={(event) => {
            event.currentTarget.src = getFallbackPhoneAvatarUrl(selectedPhone);
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-slate-900">
            {selectedPhone.verifiedName}
          </span>
          <span className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] font-semibold text-slate-500">
            <span aria-hidden="true" className="shrink-0 text-xs leading-none">{getPhoneCountryFlag(selectedPhone.displayPhoneNumber)}</span>
            {selectedPhone.displayPhoneNumber}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Chọn số WhatsApp doanh nghiệp"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {phones.map((phone) => {
            const isSelected = phone.id === selectedPhoneId;
            return (
              <button
                key={phone.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelect(phone.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50'
                    : 'hover:bg-slate-100'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={getPhoneAvatarUrl(phone)}
                    alt={`Ảnh đại diện ${phone.verifiedName}`}
                    className="h-9 w-9 rounded-full bg-slate-50 object-cover"
                    onError={(event) => {
                      event.currentTarget.src = getFallbackPhoneAvatarUrl(phone);
                    }}
                  />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1fa855]" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-900">
                    {phone.verifiedName}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] font-semibold text-slate-500">
                    <span aria-hidden="true" className="shrink-0 text-xs leading-none">{getPhoneCountryFlag(phone.displayPhoneNumber)}</span>
                    {phone.displayPhoneNumber}
                  </span>
                </span>
                {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#1fa855]" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
