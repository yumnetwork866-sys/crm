import { ShieldCheck } from 'lucide-react';

export function MessageSecurityBanner() {
  return (
    <div className="flex justify-center my-2">
      <div className="bg-[#ffeecd] border border-[#f0dfbe] text-[#54656f] text-[11px] px-3.5 py-1.5 rounded-lg shadow-sm max-w-md text-center flex items-center space-x-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>Tin nhắn được mã hóa qua Meta Graph Cloud API chính thức của WhatsApp Business.</span>
      </div>
    </div>
  );
}
