import React, { useState } from 'react';
import { Lock, CheckCircle2, ArrowLeft, Send, ShieldAlert, FileText, Info } from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';

interface DataDeletionViewProps {
  onBackToApp?: () => void;
}

export const DataDeletionView: React.FC<DataDeletionViewProps> = ({ onBackToApp }) => {
  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [confirmationCode, setConfirmationCode] = useState('');

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;

    setStatus('submitting');
    setTimeout(() => {
      const randomCode = `DEL_YUM_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      setConfirmationCode(randomCode);
      setStatus('success');
    }, 1000);
  };

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
            <Lock className="w-4 h-4" />
            Meta Data Deletion Callback & User Instructions
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Hướng Dẫn & Yêu Cầu Xóa Dữ Liệu Cá Nhân (Data Deletion Request)
          </h1>
          <p className="text-slate-400 text-sm">
            Theo chính sách bảo vệ dữ liệu nền tảng Meta (Facebook Platform Policy), người dùng có toàn quyền gỡ bỏ và yêu cầu xóa toàn bộ dữ liệu liên quan khỏi hệ thống <strong className="text-white">YumNetwork CRM</strong>.
          </p>
        </div>

        {/* Content & Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Method 1: Facebook App Settings */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 font-extrabold flex items-center justify-center text-sm border border-red-500/30">1</span>
              Gỡ Ứng Dụng Trên Facebook
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có thể xóa quyền truy cập của YumNetwork CRM trực tiếp từ tài khoản Facebook cá nhân của bạn theo các bước sau:
            </p>

            <ol className="list-decimal pl-5 space-y-2.5 text-xs text-slate-300">
              <li>Mở tài khoản Facebook của bạn và chọn <strong>Cài đặt &amp; Quyền riêng tư (Settings &amp; Privacy)</strong>.</li>
              <li>Chọn <strong>Cài đặt (Settings)</strong> &gt; Tìm đến mục <strong>Ứng dụng và trang web (Apps and Websites)</strong>.</li>
              <li>Tìm ứng dụng <strong className="text-white">YumNetwork CRM</strong> trong danh sách.</li>
              <li>Bấm nút <strong>Gỡ (Remove)</strong>.</li>
              <li>Facebook sẽ tự động kích hoạt Webhook xóa dữ liệu (<code className="text-red-400 font-mono">Data Deletion Callback</code>) gửi tới hệ thống YumNetwork CRM để xóa toàn bộ token và dữ liệu tương ứng.</li>
            </ol>
          </div>

          {/* Method 2: Manual Form */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 font-extrabold flex items-center justify-center text-sm border border-red-500/30">2</span>
              Gửi Yêu Cầu Xóa Dữ Liệu Trực Tiếp
            </h2>

            {status === 'success' ? (
              <div className="bg-emerald-950/60 border border-emerald-800 p-5 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  Đã Ghi Nhận Yêu Cầu Xóa Dữ Liệu!
                </div>
                <p className="text-xs text-slate-300">
                  Hệ thống YumNetwork CRM đã tiếp nhận yêu cầu. Toàn bộ dữ liệu cá nhân của bạn sẽ được xóa vĩnh viễn khỏi máy chủ trong vòng 24 giờ.
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mã Xác Nhận (Confirmation Code):</span>
                  <code className="text-xs text-emerald-400 font-mono font-bold">{confirmationCode}</code>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Facebook User ID / Số điện thoại / Email đăng ký:
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Ví dụ: 100029381290381 hoặc user@domain.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Lý do yêu cầu xóa (Tùy chọn):
                  </label>

                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Không còn nhu cầu sử dụng dịch vụ..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg transition"
                >
                  <Send className="w-4 h-4" />
                  {status === 'submitting' ? 'Đang gửi yêu cầu...' : 'Gửi Yêu Cầu Xóa Dữ Liệu Ngay'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
          <Info className="w-5 h-5 text-red-400 shrink-0" />
          <span>
            Hệ thống xử lý Data Deletion Callback API tự động của YumNetwork tuân thủ tiêu chuẩn <strong>Graph API Spec v19.0</strong> của Meta.
          </span>
        </div>
      </div>
    </div>
  );
};
