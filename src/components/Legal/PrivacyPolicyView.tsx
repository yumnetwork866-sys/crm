import React from 'react';
import { Shield, Lock, FileText, ArrowLeft, Mail, Phone, Building } from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';

interface PrivacyPolicyViewProps {
  onBackToApp?: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBackToApp }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header navigation */}
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
            <Shield className="w-4 h-4" />
            Meta Platform Compliance & Privacy Policy
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Chính Sách Bảo Mật Quyền Riêng Tư (Privacy Policy)
          </h1>
          <p className="text-slate-400 text-sm">
            Cập nhật lần cuối: Ngày 03 tháng 08 năm 2026 | Áp dụng cho hệ thống YumNetwork CRM & Meta Graph API Integration.
          </p>
        </div>

        {/* Document Content */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-10 space-y-8 text-slate-300 text-sm leading-relaxed shadow-2xl">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              1. Giới Thiệu Về YumNetwork CRM
            </h2>
            <p>
              Chào mừng bạn đến với <strong>YumNetwork CRM</strong> (thuộc sở hữu của YumNetwork Co., Ltd). Chúng tôi tôn trọng quyền riêng tư của bạn và cam kết bảo vệ dữ liệu cá nhân của người dùng, khách hàng cũng như dữ liệu được đồng bộ thông qua các nền tảng của Meta (Facebook Messenger, Lead Ads, Instagram và WhatsApp Business API).
            </p>
            <p>
              Chính sách bảo mật này giải thích cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin khi bạn truy cập trang web hoặc kết nối ứng dụng Meta với hệ thống YumNetwork CRM.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              2. Dữ Liệu Chúng Tôi Thu Thập Từ Meta API
            </h2>
            <p>
              Khi bạn hoặc tổ chức của bạn cấp quyền cho YumNetwork CRM kết nối với tài khoản Meta/Facebook Business, chúng tôi chỉ thu thập các dữ liệu tối thiểu cần thiết để vận hành dịch vụ CRM:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300">
              <li><strong>Thông tin hồ sơ công khai:</strong> Họ tên, ID người dùng Facebook (User ID), ảnh đại diện (khi bạn đăng nhập bằng Facebook OAuth).</li>
              <li><strong>Dữ liệu Fanpage & Messenger:</strong> ID Trang Facebook, nội dung tin nhắn gửi/nhận giữa người dùng và Fanpage để tư vấn viên phản hồi trên YumNetwork CRM.</li>
              <li><strong>Dữ liệu Khách hàng tiềm năng (Facebook Lead Ads):</strong> Họ tên, Số điện thoại, Email, Câu hỏi khảo sát mà khách hàng tự nguyện điền vào Form quảng cáo trên Facebook.</li>
              <li><strong>Dữ liệu WhatsApp Business:</strong> Số điện thoại, trạng thái tin nhắn gửi/nhận phục vụ quy trình chăm sóc tự động.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              3. Mục Đích Sử Dụng Dữ Liệu
            </h2>
            <p>Dữ liệu thu thập chỉ được dùng cho các mục đích hợp pháp sau:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Quản lý Khách hàng Tập trung</h4>
                <p className="text-xs text-slate-400">Hiển thị danh sách Lead, tạo đơn hàng và theo dõi tiến trình chăm sóc khách hàng.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Tự động hóa Messaging</h4>
                <p className="text-xs text-slate-400">Gửi tin nhắn phản hồi tự động, thông báo đơn hàng và nhắc lịch chăm sóc hậu mãi.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Báo cáo & Phân tích</h4>
                <p className="text-xs text-slate-400">Thống kê hiệu quả chiến dịch quảng cáo và doanh số của từng nhân viên Telesales.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Hỗ trợ Kỹ thuật</h4>
                <p className="text-xs text-slate-400">Giải quyết sự cố kết nối Webhook API và bảo đảm tính an toàn hệ thống.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              4. Cam Kết Không Chia Sẻ Dữ Liệu Với Bên Thứ Ba
            </h2>
            <p className="text-white font-medium">
              YumNetwork CRM cam kết tuyệt đối:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>KHÔNG bán, cho thuê hoặc thương mại hóa dữ liệu cá nhân của người dùng cho bất kỳ bên thứ ba nào.</li>
              <li>KHÔNG chia sẻ dữ liệu tin nhắn/lead ads cho các dịch vụ quảng cáo ngoài phạm vi chỉ định của khách hàng.</li>
              <li>Dữ liệu chỉ được chia sẻ khi có yêu cầu bằng văn bản từ cơ quan pháp luật có thẩm quyền theo quy định hiện hành.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              5. Bảo Mật & Lưu Trữ Dữ Liệu
            </h2>
            <p>
              Tất cả dữ liệu được mã hóa bằng chuẩn SSL/TLS 256-bit khi truyền tải qua mạng. Dữ liệu nhạy cảm (Access Tokens, App Secrets) được mã hóa một chiều và lưu trữ trên máy chủ hạ tầng bảo mật cao với cơ chế kiểm soát truy cập phân quyền nghiêm ngặt.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-red-400 border-b border-slate-800 pb-2">
              6. Quyền Hạn Của Người Dùng & Yêu Cầu Xóa Dữ Liệu (Data Deletion)
            </h2>
            <p>
              Người dùng có quyền hủy kết nối ứng dụng YumNetwork CRM khỏi tài khoản Meta bất kỳ lúc nào thông qua phần <em>Settings & Privacy &gt; Apps and Websites</em> trên Facebook.
            </p>
            <p>
              Để gửi yêu cầu xóa toàn bộ dữ liệu lưu trữ trên hệ thống YumNetwork CRM, vui lòng truy cập trang{' '}
              <a href="#data-deletion" className="text-red-400 underline font-semibold hover:text-red-300">
                Hướng dẫn Xóa Dữ Liệu (User Data Deletion)
              </a>{' '}
              hoặc gửi email trực tiếp tới bộ phận bảo mật của chúng tôi.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 text-slate-200">
              7. Thông Tin Liên Hệ Bảo Mật
            </h2>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Building className="w-4 h-4 text-red-400 shrink-0" />
                <span><strong>Đơn vị chủ quản:</strong> Công Ty YumNetwork Co., Ltd</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-4 h-4 text-red-400 shrink-0" />
                <span><strong>Email DPO (Bảo vệ dữ liệu):</strong> privacy@yumnetwork.com</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-red-400 shrink-0" />
                <span><strong>Hotline hỗ trợ:</strong> (+84) 098 765 4321</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
