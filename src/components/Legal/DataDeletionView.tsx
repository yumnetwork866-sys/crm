import React from 'react';
import { Lock, ArrowLeft, Info, Mail, ShieldCheck } from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';

interface DataDeletionViewProps {
  onBackToApp?: () => void;
}

export const DataDeletionView: React.FC<DataDeletionViewProps> = ({ onBackToApp }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-6">
          <button
            onClick={() => {
              if (onBackToApp) {
                onBackToApp();
              } else {
                history.pushState('', document.title, window.location.pathname + window.location.search);
                window.location.reload();
              }
            }}
            className="cursor-pointer text-left hover:opacity-90 transition"
            title="Về Trang Chủ"
          >
            <YumLogo size="lg" showText={false} />
          </button>
          
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
            <Lock className="w-4 h-4" />
            Meta Data Deletion Callback &amp; User Instructions
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Hướng Dẫn Xóa Dữ Liệu Cá Nhân (Data Deletion Instructions)
          </h1>
          <p className="text-slate-800 text-sm font-bold leading-relaxed">
            Theo chính sách bảo vệ dữ liệu nền tảng Meta (Facebook Platform Policy), người dùng có toàn quyền gỡ bỏ và yêu cầu xóa toàn bộ dữ liệu liên quan khỏi hệ thống <strong className="text-slate-950 font-black">YumNetwork CRM</strong>.
          </p>
        </div>

        {/* Full-width Section: Facebook App Settings */}
        <div className="bg-white border border-slate-300 rounded-3xl p-6 sm:p-10 space-y-6 shadow-xl">
          <h2 className="text-xl font-black text-slate-950 flex items-center gap-3 border-b border-slate-300 pb-4">
            <span className="w-8 h-8 rounded-xl bg-red-100 text-red-700 font-black flex items-center justify-center text-sm border border-red-300 shrink-0">1</span>
            Hướng Dẫn Gỡ Ứng Dụng &amp; Kích Hoạt Xóa Dữ Liệu Tự Động Trên Facebook
          </h2>

          <p className="text-sm text-slate-800 leading-relaxed font-semibold">
            Bạn có thể chủ động hủy kết nối và kích hoạt tiến trình xóa dữ liệu cá nhân của YumNetwork CRM trực tiếp từ tài khoản Facebook cá nhân theo 5 bước sau:
          </p>

          <ol className="list-decimal pl-6 space-y-3 text-sm text-slate-800 font-semibold leading-relaxed">
            <li>Mở tài khoản Facebook của bạn và chọn <strong className="text-slate-950 font-black">Cài đặt &amp; Quyền riêng tư (Settings &amp; Privacy)</strong>.</li>
            <li>Chọn <strong className="text-slate-950 font-black">Cài đặt (Settings)</strong> &gt; Tìm đến mục <strong className="text-slate-950 font-black">Ứng dụng và trang web (Apps and Websites)</strong>.</li>
            <li>Tìm ứng dụng <strong className="text-slate-950 font-black">YumNetwork CRM</strong> trong danh sách các ứng dụng đã kết nối.</li>
            <li>Bấm nút <strong className="text-slate-950 font-black">Gỡ (Remove)</strong>.</li>
            <li>Facebook sẽ tự động gửi thông báo Webhook (<code className="text-red-600 font-mono font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">Data Deletion Callback API</code>) tới hệ thống YumNetwork CRM để tiến hành hủy Access Token và thu hồi toàn bộ dữ liệu lưu trữ tương ứng trong vòng 24 giờ.</li>
          </ol>

          {/* Email Support Box */}
          <div className="bg-slate-100 border border-slate-300 p-6 rounded-2xl space-y-3 mt-6">
            <div className="flex items-center gap-2 text-slate-950 font-black text-sm">
              <Mail className="w-5 h-5 text-red-600 shrink-0" />
              <span>Hỗ Trợ Xóa Dữ Liệu Thủ Công Qua Email (Email Data Deletion Contact)</span>
            </div>
            <p className="text-xs text-slate-800 font-semibold leading-relaxed">
              Trong trường hợp bạn muốn kiểm tra trạng thái xóa dữ liệu hoặc cần bộ phận kỹ thuật xóa dữ liệu cá nhân thủ công, vui lòng gửi email trực tiếp kèm thông tin tài khoản (Facebook User ID / Số điện thoại đăng ký) về các địa chỉ sau:
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-950 pt-2 border-t border-slate-300">
              <div>
                <span className="text-slate-950 font-black">Email Hỗ Trợ &amp; DPO:</span>{' '}
                <a href="mailto:hello@yumnetwork.vn" className="text-red-600 underline font-black hover:text-red-700">
                  hello@yumnetwork.vn
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 text-xs text-slate-800 font-bold flex items-center gap-3 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            Hệ thống xử lý Data Deletion Callback API tự động của YumNetwork tuân thủ nghiêm ngặt tiêu chuẩn <strong className="text-slate-950 font-black">Meta Graph API Spec v19.0</strong>.
          </span>
        </div>
      </div>
    </div>
  );
};
