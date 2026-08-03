import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ExternalLink, 
  CheckCircle2, 
  Copy, 
  FileText, 
  Key, 
  Server, 
  Globe, 
  UserCheck, 
  Building2, 
  Lock,
  Facebook
} from 'lucide-react';

interface MetaVerificationViewProps {
  onNavigateLegal?: (page: 'privacy' | 'terms' | 'deletion') => void;
}

export const MetaVerificationView: React.FC<MetaVerificationViewProps> = ({ onNavigateLegal }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [appId, setAppId] = useState('948201948123904');
  const [appSecret, setAppSecret] = useState('e84f901a87b32c9123891238910abfde');
  const [verifyToken, setVerifyToken] = useState('YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');
  const [appMode, setAppMode] = useState<'development' | 'live'>('development');

  const domain = window.location.origin;

  const legalUrls = {
    privacy: `${domain}/#privacy`,
    terms: `${domain}/#terms`,
    deletion: `${domain}/#data-deletion`,
    webhook: `${domain}/api/meta/webhooks`,
    deletionCallback: `${domain}/api/meta/data-deletion`,
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const permissionsList = [
    {
      name: 'pages_messaging',
      category: 'Messenger API',
      status: 'Ready for Review',
      description: 'Cho phép YumNetwork CRM nhận và gửi tin nhắn tự động / thủ công với khách hàng qua Facebook Messenger.',
      justification: 'YumNetwork CRM là nền tảng quản lý chăm sóc khách hàng tập trung. Quyền này bắt buộc để bộ phận Telesales/CSKH gửi câu trả lời và thông báo đơn hàng cho khách hàng qua Messenger.'
    },
    {
      name: 'leads_retrieval',
      category: 'Facebook Lead Ads',
      status: 'Ready for Review',
      description: 'Đồng bộ tự động thông tin khách hàng từ Form Quảng cáo Facebook Lead Ads vào hệ thống YumNetwork CRM.',
      justification: 'Giúp tự động thu nạp dữ liệu Lead Ads thời gian thực, phân bổ Telesales tư vấn ngay lập tức, gia tăng tỷ lệ chuyển đổi đơn hàng.'
    },
    {
      name: 'pages_read_engagement',
      category: 'Page Analytics & Engagement',
      status: 'Approved',
      description: 'Đọc thông tin tương tác Fanpage để thống kê báo cáo hiệu quả chiến dịch Marketing.',
      justification: 'Dùng để tính toán chỉ số ROI, chi phí trên mỗi Lead và tỷ lệ tương tác của từng chiến dịch quảng cáo.'
    },
    {
      name: 'whatsapp_business_messaging',
      category: 'WhatsApp Business Cloud API',
      status: 'Ready for Review',
      description: 'Tự động gửi tin nhắn WhatsApp chăm sóc khách hàng theo quy trình Ngày +3, +5, +7, +15.',
      justification: 'Dùng để kích hoạt chuỗi Automation chăm sóc hậu mãi, gửi thông báo mã giảm giá và khảo sát sự hài lòng sau khi mua hàng.'
    }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 bg-slate-50 text-slate-900">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 border border-red-200 text-red-600 text-xs font-bold mb-3">
              <ShieldCheck className="w-4 h-4" />
              Meta App Review &amp; Business Verification Hub
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              Trung Tâm Xác Minh Meta &amp; App Review
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl text-sm sm:text-base leading-relaxed font-medium">
              Cấu hình các thông tin pháp lý, API Webhooks và Portal hướng dẫn Kiểm duyệt viên Meta duyệt ứng dụng <strong className="text-slate-900">YumNetwork CRM</strong> một cách nhanh chóng nhất.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateLegal?.('privacy')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              Privacy Policy
            </button>
            <button
              onClick={() => onNavigateLegal?.('terms')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
            >
              <Globe className="w-4 h-4 text-slate-500" />
              Terms of Service
            </button>
            <button
              onClick={() => onNavigateLegal?.('deletion')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition cursor-pointer"
            >
              <Lock className="w-4 h-4 text-red-600" />
              Data Deletion
            </button>
          </div>
        </div>
      </div>

      {/* Meta App Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* App Credentials & Status */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-red-600" />
              Thông Tin Ứng Dụng Meta App Dashboard
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              appMode === 'live' 
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              Chế độ: {appMode === 'live' ? 'Live (Đã Duyệt)' : 'In Development (Đang Kiểm Duyệt)'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Meta App ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none pr-10 font-bold"
                />
                <button
                  onClick={() => copyToClipboard(appId, 'appId')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1.5 cursor-pointer"
                  title="Copy App ID"
                >
                  {copiedField === 'appId' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Meta App Secret
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none pr-10 font-bold"
                />
                <button
                  onClick={() => copyToClipboard(appSecret, 'appSecret')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1.5 cursor-pointer"
                  title="Copy App Secret"
                >
                  {copiedField === 'appSecret' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Webhook Verify Token
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none pr-10 font-bold"
                />
                <button
                  onClick={() => copyToClipboard(verifyToken, 'verifyToken')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1.5 cursor-pointer"
                  title="Copy Token"
                >
                  {copiedField === 'verifyToken' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook URLs */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              Đường Dẫn Callback Webhooks Cần Điền Trên Meta Developer Console
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 block font-bold">Webhook URL (Messenger &amp; Lead Ads)</span>
                  <code className="text-xs text-red-600 font-mono font-bold">{legalUrls.webhook}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(legalUrls.webhook, 'webhook')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-300 transition cursor-pointer shadow-xs"
                >
                  {copiedField === 'webhook' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy URL
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 block font-bold">User Data Deletion Callback URL</span>
                  <code className="text-xs text-emerald-700 font-mono font-bold">{legalUrls.deletionCallback}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(legalUrls.deletionCallback, 'deletionCallback')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-300 transition cursor-pointer shadow-xs"
                >
                  {copiedField === 'deletionCallback' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Requirements Checklist */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Checklist Duyệt Nhanh Meta
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-800">Privacy Policy Public</h4>
                  <p className="text-[11px] text-slate-600 font-medium">Đã xuất bản trang chính sách bảo mật công khai.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-800">Terms of Service Public</h4>
                  <p className="text-[11px] text-slate-600 font-medium">Đã xuất bản điều khoản dịch vụ công khai.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-800">User Data Deletion Callback</h4>
                  <p className="text-[11px] text-slate-600 font-medium">Đã có API xử lý signed_request xóa dữ liệu chuẩn Meta.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-blue-800">Business Verification</h4>
                  <p className="text-[11px] text-slate-600 font-medium">CÔNG TY TNHH TRUYỀN THÔNG YUM NETWORK đã chuẩn bị GPKD &amp; Giấy tờ công ty.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-xs shadow-md transition"
            >
              Mở Meta Developer Console
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Reviewer Portal Kit for Meta Reviewers */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-red-600" />
              Tài Nguyên Kiểm Duyệt Dành Cho Meta Reviewer (Reviewer Portal Kit)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
              Điền thông tin bên dưới vào ô <strong>"Instructions for Reviewers"</strong> trên Meta Dashboard để reviewer test ứng dụng trực tiếp.
            </p>
          </div>

          <button
            onClick={() => {
              const kitText = `YumNetwork CRM Meta Review Credentials:
URL: ${domain}
Test Username: meta_reviewer@yumnetwork.com
Test Password: MetaReviewer2026!
Instructions:
1. Access the web app at ${domain}
2. Click on "Xác minh Meta" menu tab.
3. Test Facebook Login flow and permission consent for pages_messaging & leads_retrieval.
4. Messages received on Facebook page sync instantly into YumNetwork CRM Inbox.`;
              copyToClipboard(kitText, 'reviewerKit');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition cursor-pointer shrink-0"
          >
            {copiedField === 'reviewerKit' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            Copy Toàn Bộ Hướng Dẫn Reviewer
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">1. Demo Web App URL</span>
            <code className="text-xs text-slate-900 font-mono font-bold block break-all">{domain}</code>
            <p className="text-[11px] text-slate-600 font-medium">Đã mở sẵn IP/Domain public để Meta Reviewer truy cập không bị chặn firewall.</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">2. Test User Account</span>
            <div className="text-xs text-slate-700 space-y-1 font-mono">
              <div>User: <strong className="text-slate-900 font-bold">meta_reviewer@yumnetwork.com</strong></div>
              <div>Pass: <strong className="text-slate-900 font-bold">MetaReviewer2026!</strong></div>
            </div>
            <p className="text-[11px] text-slate-600 font-medium">Tài khoản có đầy đủ quyền Admin và Fanpage Test đã tích hợp sẵn.</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">3. Screencast Video Guidelines</span>
            <p className="text-xs text-slate-700 font-medium">
              Video demo 1-3 phút quay luồng Facebook OAuth + Hiển thị rõ App ID <strong>{appId}</strong> trên URL trình duyệt.
            </p>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đạt chuẩn quy cách Meta 100%
            </div>
          </div>
        </div>
      </div>

      {/* Permissions & Use Case Justifications */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-lg space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
            <FileText className="w-6 h-6 text-red-600" />
            Bảng Giải Trình Lý Do Xin Quyền (Permission Use Case Justification)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
            Sao chép các đoạn văn bản giải trình đã tối ưu dưới đây dán vào các ô xin quyền tương ứng trên Meta App Review Submission Form.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {permissionsList.map((perm) => (
            <div key={perm.name} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-red-600">{perm.name}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-300 font-bold">
                    {perm.category}
                  </span>
                </div>

                <button
                  onClick={() => copyToClipboard(perm.justification, perm.name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-lg border border-slate-300 transition cursor-pointer shadow-xs"
                >
                  {copiedField === perm.name ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Đoạn Giải Trình
                </button>
              </div>

              <p className="text-xs text-slate-700 font-medium">{perm.description}</p>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Đoạn giải trình mẫu cho Meta Reviewer (English &amp; Vietnamese):
                </span>
                <p className="text-xs text-slate-800 italic leading-relaxed font-medium">
                  "{perm.justification}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
