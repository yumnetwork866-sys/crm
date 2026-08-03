import React from 'react';
import { Globe, Shield, ArrowLeft, Mail, FileText } from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';

interface TermsOfServiceViewProps {
  onBackToApp?: () => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onBackToApp }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <YumLogo size="lg" />
          
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại Hệ Thống CRM
            </button>
          )}
        </div>

        {/* Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            <Globe className="w-4 h-4" />
            Meta Platform Compliance & Terms of Service
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Điều Khoản Dịch Vụ (Terms of Service)
          </h1>
          <p className="text-slate-400 text-sm">
            Cập nhật lần cuối: Ngày 03 tháng 08 năm 2026 | Quy định sử dụng nền tảng YumNetwork CRM.
          </p>
        </div>

        {/* Content */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-10 space-y-8 text-slate-300 text-sm leading-relaxed shadow-2xl">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              1. Chấp Thuận Điều Khoản
            </h2>
            <p>
              Bằng việc đăng ký, truy cập hoặc sử dụng phần mềm <strong>YumNetwork CRM</strong>, bạn đồng ý tuân thủ toàn bộ các điều khoản và điều kiện được quy định trong tài liệu này. Nếu bạn không đồng ý với bất kỳ phần nào của điều khoản, vui lòng ngừng sử dụng dịch vụ.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              2. Tuân Thủ Tiêu Chuẩn Nền Tảng Meta (Meta Platform Terms & Developer Policies)
            </h2>
            <p>
              YumNetwork CRM tích hợp các dịch vụ API của Meta (Facebook Messenger, WhatsApp Business, Lead Ads, Instagram Graph API). Người dùng kết nối tài khoản Meta vào CRM cam kết:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300">
              <li>Tuân thủ <strong>Meta Platform Terms</strong> và <strong>Developer Policies</strong> hiện hành.</li>
              <li>Không gửi tin nhắn rác (Spam), thông tin sai sự thật, hoặc vi phạm Tiêu chuẩn cộng đồng của Facebook/WhatsApp.</li>
              <li>Tự chịu trách nhiệm về nội dung tin nhắn và dữ liệu khách hàng được lưu trữ trên tài khoản CRM của mình.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              3. Tài Khoản & Bảo Mật
            </h2>
            <p>
              Bạn có trách nhiệm bảo mật thông tin đăng nhập tài khoản CRM của mình. YumNetwork không chịu trách nhiệm đối với bất kỳ tổn thất nào phát sinh từ việc bạn chia sẻ mật khẩu hoặc không bảo vệ tài khoản cá nhân.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              4. Giới Hạn Trách Nhiệm Pháp Lý
            </h2>
            <p>
              YumNetwork nỗ lực đảm bảo hệ thống hoạt động ổn định 24/7. Tuy nhiên, chúng tôi không chịu trách nhiệm trong trường hợp gián đoạn dịch vụ do sự cố hạ tầng từ bên thứ ba (ví dụ: Meta API bảo trì, mất kết nối internet toàn cầu hoặc thiên tai, bất khả kháng).
            </p>
          </section>

          <section className="space-y-3 border-t border-slate-800 pt-4">
            <h2 className="text-lg font-bold text-white">5. Liên Hệ Giải Đáp Điều Khoản</h2>
            <p className="text-xs text-slate-400">
              Mọi thắc mắc liên quan đến Điều khoản dịch vụ YumNetwork CRM, vui lòng gửi email về: <strong className="text-white">support@yumnetwork.com</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
