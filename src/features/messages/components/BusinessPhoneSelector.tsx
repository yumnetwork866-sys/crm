import { ChevronDown, Phone } from 'lucide-react';
import type { BusinessPhoneNumber } from '../types';

interface BusinessPhoneSelectorProps {
  phones: BusinessPhoneNumber[];
  selectedPhoneId: string;
  onSelect: (phoneId: string) => void;
}

export function BusinessPhoneSelector({ phones, selectedPhoneId, onSelect }: BusinessPhoneSelectorProps) {
  return (
    <div className="relative min-w-0 flex-1">
      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#008069]">
        <Phone className="w-3.5 h-3.5" />
      </div>
      <select
        id="waba-phone-select"
        value={selectedPhoneId}
        onChange={(event) => onSelect(event.target.value)}
        className="w-full appearance-none bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 focus:border-[#008069] focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition cursor-pointer shadow-xs truncate"
        title="Chọn số Doanh nghiệp gửi tin (WABA)"
      >
        {phones.map((phone) => (
          <option key={phone.id} value={phone.id}>
            {phone.displayPhoneNumber} — {phone.verifiedName}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
        <ChevronDown className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}
