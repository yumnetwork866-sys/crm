import React from 'react';
import { Globe, ArrowLeft } from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';

interface TermsOfServiceViewProps {
  onBackToApp?: () => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onBackToApp }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-6">
          <YumLogo size="lg" showText={false} />
          
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold transition shadow-md cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại Trang Chủ
            </button>
          )}
        </div>

        {/* Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-100 border border-red-300 text-red-700 text-xs font-black">
            <Globe className="w-4 h-4" />
            Meta Platform Compliance &amp; Terms of Service
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Điều Khoản Dịch Vụ (Terms of Service)
          </h1>
          <p className="text-slate-800 text-sm font-bold">
            Cập nhật lần cuối: Ngày 03 tháng 08 năm 2026 | Quy định sử dụng nền tảng YumNetwork CRM.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white border border-slate-300 rounded-3xl p-6 sm:p-10 space-y-8 text-slate-900 text-sm leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-950 border-b border-slate-300 pb-2">
              1. Chấp Thuận Điều Khoản
            </h2>
            <p className="text-slate-800 font-semibold leading-relaxed">
              Bằng việc đăng ký, truy cập hoặc sử dụng phần mềm <strong className="text-slate-950 font-black">YumNetwork CRM</strong>, bạn đồng ý tuân thủ toàn bộ các điều khoản và điều kiện được quy định trong tài liệu này. Nếu bạn không đồng ý với bất kỳ phần nào của điều khoản, vui lòng ngừng sử dụng dịch vụ.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-950 border-b border-slate-300 pb-2">
              2. Tuân Thủ Tiêu Chuẩn Nền Tảng Meta (Meta Platform Terms &amp; Developer Policies)
            </h2>
            <p className="text-slate-800 font-semibold leading-relaxed">
              YumNetwork CRM tích hợp các dịch vụ API của Meta (Facebook Messenger, WhatsApp Business, Lead Ads, Instagram Graph API). Người dùng kết nối tài khoản Meta vào CRM cam kết:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-800 font-semibold">
              <li>Tuân thủ <strong className="text-slate-950 font-black">Meta Platform Terms</strong> và <strong className="text-slate-950 font-black">Developer Policies</strong> hiện hành.</li>
              <li>Không gửi tin nhắn rác (Spam), thông tin sai sự thật, hoặc vi phạm Tiêu chuẩn cộng đồng của Facebook/WhatsApp.</li>
              <li>Tự chịu trách nhiệm về nội dung tin nhắn và dữ liệu khách hàng được lưu trữ trên tài khoản CRM của mình.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-950 border-b border-slate-300 pb-2">
              3. Tài Khoản &amp; Bảo Mật
            </h2>
            <p className="text-slate-800 font-semibold leading-relaxed">
              Bạn có trách nhiệm bảo mật thông tin đăng nhập tài khoản CRM của mình. YumNetwork không chịu trách nhiệm đối với bất kỳ tổn thất nào phát sinh từ việc bạn chia sẻ mật khẩu hoặc không bảo vệ tài khoản cá nhân.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-950 border-b border-slate-300 pb-2">
              4. Giới Hạn Trách Nhiệm Pháp Lý
            </h2>
            <p className="text-slate-800 font-semibold leading-relaxed">
              YumNetwork nỗ lực đảm bảo hệ thống hoạt động ổn định 24/7. Tuy nhiên, chúng tôi không chịu trách nhiệm trong trường hợp gián đoạn dịch vụ do sự cố hạ tầng từ bên thứ ba (ví dụ: Meta API bảo trì, mất kết nối internet toàn cầu hoặc thiên tai, bất khả kháng).
            </p>
          </section>

          <section className="space-y-3 border-t border-slate-300 pt-4">
            <h2 className="text-lg font-black text-slate-950">5. Liên Hệ Giải Đáp Điều Khoản</h2>
            <p className="text-xs text-slate-900 font-extrabold leading-relaxed">
              Mọi thắc mắc liên quan đến Điều khoản dịch vụ YumNetwork CRM, vui lòng gửi email về: <strong className="text-red-600 font-black">support@yumnetwork.vn</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
