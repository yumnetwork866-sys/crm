import React from 'react';
import { 
  ShieldCheck, 
  Zap, 
  MessageSquare, 
  Users, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Globe, 
  FileText, 
  Layers, 
  Sparkles, 
  ChevronRight, 
  LogIn, 
  UserCheck, 
  Bot,
  Send
} from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';

interface PublicLandingViewProps {
  onOpenLogin: () => void;
  onNavigateLegal: (page: 'privacy' | 'terms' | 'deletion' | 'meta-verification') => void;
  onQuickDemoLogin?: () => void;
}

export const PublicLandingView: React.FC<PublicLandingViewProps> = ({
  onOpenLogin,
  onNavigateLegal,
  onQuickDemoLogin,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-red-600 selection:text-white relative overflow-hidden">
      
      {/* Light Mode Subtle Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-red-200/50 via-red-100/20 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[600px] right-0 w-[500px] h-[500px] bg-blue-100/40 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[1200px] left-0 w-[500px] h-[500px] bg-emerald-100/40 blur-3xl pointer-events-none -z-10" />

      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.hash) {
                history.pushState('', document.title, window.location.pathname + window.location.search);
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <YumLogo size="lg" showText={false} />
          </a>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-extrabold text-slate-900">
            <a href="#features" className="hover:text-red-600 transition">Tính Năng</a>
            <a href="#meta-integration" className="hover:text-red-600 transition flex items-center gap-1.5">
              <span>Tích Hợp Meta</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 border border-red-300">API v19.0</span>
            </a>
            <a href="#compliance" className="hover:text-red-600 transition">Pháp Lý &amp; Bảo Mật</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-extrabold shadow-md shadow-red-600/30 transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Đăng Nhập CRM
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-300 shadow-sm mb-8 animate-fade-in">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-extrabold text-slate-900">
            Nền Tảng Quản Lý Khách Hàng Tập Trung &amp; Meta Graph API Verified
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-950 leading-[1.15] max-w-5xl mx-auto">
          Tối Ưu Doanh Số &amp; Automation CSKH Với{' '}
          <span className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 bg-clip-text text-transparent">
            YumNetwork CRM
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-slate-800 max-w-3xl mx-auto font-semibold leading-relaxed">
          Đồng bộ tự động dữ liệu <strong className="text-slate-950 font-black">Facebook Lead Ads</strong>, quản lý tin nhắn hội thoại <strong className="text-slate-950 font-black">Messenger &amp; WhatsApp Business</strong> tập trung. Kích hoạt chuỗi gửi tin chăm sóc khách hàng tự động Ngày +3, +5, +7, +15.
        </p>

        {/* Dashboard Preview Mockup (High Contrast Light Theme) */}
        <div className="mt-14 relative max-w-5xl mx-auto rounded-3xl bg-white border border-slate-300 p-3 sm:p-4 shadow-2xl shadow-slate-300/80">
          <div className="rounded-2xl bg-slate-200/90 text-slate-900 overflow-hidden border border-slate-300 p-4 sm:p-6 text-left">
            {/* Top Bar Mockup */}
            <div className="flex items-center justify-between border-b border-slate-300 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-600" />
                  <div className="w-3 h-3 rounded-full bg-amber-600" />
                  <div className="w-3 h-3 rounded-full bg-emerald-600" />
                </div>
                <span className="text-xs font-mono text-slate-900 font-extrabold">https://crm.yumnetwork.com/dashboard</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-400 text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                Live Demo Mode
              </div>
            </div>

            {/* Dashboard Mockup Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-300 p-4 rounded-xl space-y-2 shadow-md">
                <div className="flex justify-between items-center text-xs text-slate-900 font-black">
                  <span>Khách Hàng Lead Ads (Meta)</span>
                  <Users className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-2xl font-black text-slate-950">1,248 Leads</div>
                <div className="text-[11px] text-emerald-700 font-black">+18.5% so với tuần trước</div>
              </div>

              <div className="bg-white border border-slate-300 p-4 rounded-xl space-y-2 shadow-md">
                <div className="flex justify-between items-center text-xs text-slate-900 font-black">
                  <span>Tin Nhắn Messenger &amp; WhatsApp</span>
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-950">8,920 Messages</div>
                <div className="text-[11px] text-blue-700 font-black">Tự động trả lời Webhooks API</div>
              </div>

              <div className="bg-white border border-slate-300 p-4 rounded-xl space-y-2 shadow-md">
                <div className="flex justify-between items-center text-xs text-slate-900 font-black">
                  <span>Quy Trình Automation Active</span>
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-slate-950">4 Chuỗi Tự Động</div>
                <div className="text-[11px] text-amber-800 font-black">CSKH Ngày +3, +5, +7, +15</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Features Grid */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-300">
        <div className="space-y-12 text-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-100 border border-red-300 text-red-700 text-xs font-black">
              <Zap className="w-4 h-4" />
              Tính Năng Nổi Bật Nền Tảng YumNetwork CRM
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Giải Pháp Toàn Diện Cho Doanh Nghiệp Bán Hàng &amp; Marketing
            </h2>
            <p className="text-slate-800 max-w-2xl mx-auto text-sm sm:text-base font-bold">
              Tích hợp đầy đủ các mô-đun quản lý khách hàng, đơn hàng, phân nhóm thông minh và gửi tin nhắn tự động hàng loạt.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="bg-white border border-slate-300 p-6 rounded-3xl space-y-4 hover:border-red-400 hover:shadow-xl transition shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center border border-red-300">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Quản Lý Data Khách Hàng Tập Trung</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Lưu trữ toàn bộ thông tin Lead, lịch sử mua hàng, tổng chi tiêu và ghi chú CSKH trên một màn hình quản trị duy nhất.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-3xl space-y-4 hover:border-red-400 hover:shadow-xl transition shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-300">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Phân Nhóm Khách Hàng Thông Minh</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Tự động xếp hạng khách hàng từ Nhóm 1 đến Nhóm 4 dựa trên giá trị vòng đời (CLV) và số lượng đơn hàng phát sinh.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-3xl space-y-4 hover:border-red-400 hover:shadow-xl transition shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-300">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Automation CSKH Ngày +3, +5, +7, +15</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Tự động gửi lời cảm ơn sau mua, hướng dẫn sử dụng, giải đáp thắc mắc và tặng Voucher tri ân hoàn toàn tự động.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-3xl space-y-4 hover:border-red-400 hover:shadow-xl transition shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Gửi Chiến Dịch Hàng Loạt (Broadcast)</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Gửi thông báo khuyến mãi đồng loạt qua WhatsApp / Messenger với tỷ lệ mở tin vượt trội so với Email Marketing.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-3xl space-y-4 hover:border-red-400 hover:shadow-xl transition shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-300">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Báo Cáo Analytics &amp; ROI Sales</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Theo dõi biểu đồ doanh thu theo thời gian thực, đo lường chỉ số ROI chiến dịch quảng cáo và hiệu suất làm việc của Sales.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-3xl space-y-4 hover:border-red-400 hover:shadow-xl transition shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-300">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Phân Quyền Nhân Sự Đa Vai Trò</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Quản lý đội ngũ nhân viên Telesales, CSKH, Marketing với phân quyền bảo mật dữ liệu khách hàng nghiêm ngặt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Meta App Review & Integration Showcase Section */}
      <section id="meta-integration" className="py-16 sm:py-24 bg-slate-200/60 border-t border-b border-slate-300 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-100 border border-red-300 text-red-700 text-xs font-black">
              <ShieldCheck className="w-4 h-4" />
              Meta App Review &amp; Permissions Standard
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Tích Hợp Meta Graph API Chuẩn Duyệt Phê Duyệt
            </h2>
            <p className="text-slate-800 max-w-2xl mx-auto text-sm sm:text-base font-bold">
              Hệ thống YumNetwork CRM được thiết kế tuân thủ nghiêm ngặt các quy định về bảo mật dữ liệu người dùng và tiêu chuẩn nhà phát triển của Meta.
            </p>
          </div>

          {/* Grid Quyền & Tính Năng Meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-300 p-6 rounded-2xl space-y-4 hover:border-slate-400 hover:shadow-md transition shadow-xs">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-900 border border-blue-300 font-extrabold text-xs">
                <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                Messenger API
              </div>
              <h3 className="text-base font-black text-slate-950 font-mono">pages_messaging</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Đồng bộ tin nhắn phản hồi giữa khách hàng Facebook Fanpage và giao diện tư vấn viên trên YumNetwork CRM.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-2xl space-y-4 hover:border-slate-400 hover:shadow-md transition shadow-xs">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-100 text-red-900 border border-red-300 font-extrabold text-xs">
                <FileText className="w-4 h-4 text-red-600 shrink-0" />
                Facebook Lead Ads
              </div>
              <h3 className="text-base font-black text-slate-950 font-mono">leads_retrieval</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Tự động thu nạp dữ liệu Lead Ads thời gian thực ngay khi khách hàng điền form trên quảng cáo Facebook.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-2xl space-y-4 hover:border-slate-400 hover:shadow-md transition shadow-xs">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-xs">
                <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                WhatsApp API
              </div>
              <h3 className="text-base font-black text-slate-950 font-mono">whatsapp_business</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Gửi thông báo mã đơn hàng, voucher tri ân và nhắc lịch chăm sóc tự động qua WhatsApp Cloud API.
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-2xl space-y-4 hover:border-slate-400 hover:shadow-md transition shadow-xs">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-xs">
                <BarChart3 className="w-4 h-4 text-amber-600 shrink-0" />
                Page Analytics
              </div>
              <h3 className="text-base font-black text-slate-950 font-mono">pages_read_engagement</h3>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                Thống kê hiệu quả chiến dịch Marketing, tính toán chỉ số ROI và chi phí trên từng Lead Ads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Public Legal & Reviewer Portal Quick Access */}
      <section id="compliance" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-white border border-slate-300 rounded-3xl p-8 sm:p-12 shadow-xl space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-300 pb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950">
                Các Trang Pháp Lý &amp; Công Cụ Kiểm Duyệt Meta
              </h2>
              <p className="text-xs sm:text-sm text-slate-800 mt-1 font-bold">
                Tất cả các tài nguyên dưới đây mở <strong className="text-slate-950 font-black">công khai 100%</strong> cho Meta Reviewer truy cập không cần đăng nhập.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-300">
                Public Access Ready
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => onNavigateLegal('privacy')}
              className="p-6 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-left space-y-2 transition group cursor-pointer"
            >
              <FileText className="w-6 h-6 text-red-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-slate-950 text-sm">Chính Sách Bảo Mật</h3>
              <p className="text-xs text-slate-800 font-semibold">Privacy Policy chi tiết quy định lưu trữ dữ liệu cá nhân.</p>
              <div className="text-xs text-red-600 font-black flex items-center gap-1 pt-1">
                Xem ngay <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => onNavigateLegal('terms')}
              className="p-6 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-left space-y-2 transition group cursor-pointer"
            >
              <Globe className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-slate-950 text-sm">Điều Khoản Dịch Vụ</h3>
              <p className="text-xs text-slate-800 font-semibold">Terms of Service tuân thủ Meta Developer Policies.</p>
              <div className="text-xs text-blue-600 font-black flex items-center gap-1 pt-1">
                Xem ngay <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => onNavigateLegal('deletion')}
              className="p-6 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-left space-y-2 transition group cursor-pointer"
            >
              <Lock className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-slate-950 text-sm">Hướng Dẫn Xóa Dữ Liệu</h3>
              <p className="text-xs text-slate-800 font-semibold">User Data Deletion Instructions &amp; Callback Endpoint.</p>
              <div className="text-xs text-emerald-600 font-black flex items-center gap-1 pt-1">
                Xem ngay <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-slate-300 bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <YumLogo size="md" showText={false} />

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-900 font-black">
              <button onClick={() => onNavigateLegal('privacy')} className="hover:text-red-600 transition cursor-pointer">Chính Sách Bảo Mật</button>
              <button onClick={() => onNavigateLegal('terms')} className="hover:text-red-600 transition cursor-pointer">Điều Khoản Dịch Vụ</button>
              <button onClick={() => onNavigateLegal('deletion')} className="hover:text-red-600 transition cursor-pointer">Xóa Dữ Liệu</button>
            </div>
          </div>

          <div className="border-t border-slate-300 pt-6 flex flex-col md:flex-row justify-between items-start text-xs text-slate-800 gap-4 font-extrabold">
            <div className="space-y-1">
              <div className="text-slate-950 font-black">CÔNG TY TNHH TRUYỀN THÔNG YUM NETWORK</div>
              <div className="text-slate-800 font-semibold">Trụ sở chính: Tầng 1, Tòa nhà Dreamland Bonanza, 23 Duy Tân, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam</div>
              <div className="text-slate-800 font-semibold">Hotline hỗ trợ: 0985 601 051</div>
            </div>
            <div className="shrink-0 text-slate-700 font-bold">
              YumNetwork CRM &copy; 2026. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};
