import React, { useState, useEffect } from 'react';
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
  MessageSquare,
  Send,
  RefreshCw,
  AlertTriangle,
  Zap,
  Radio
} from 'lucide-react';

interface MetaVerificationViewProps {
  onNavigateLegal?: (page: 'privacy' | 'terms' | 'deletion') => void;
}

export const MetaVerificationView: React.FC<MetaVerificationViewProps> = ({ onNavigateLegal }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Integration Config States
  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [hasToken, setHasToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState('');
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);

  // Test Connection States
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveAlert, setSaveAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testAlert, setTestAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const domain = window.location.origin;

  const legalUrls = {
    privacy: `${domain}/#privacy`,
    terms: `${domain}/#terms`,
    deletion: `${domain}/#data-deletion`,
    webhook: `${domain}/api/meta/webhooks`,
    deletionCallback: `${domain}/api/meta/data-deletion`,
    authCallback: `${domain}/api/auth/facebook/callback`,
  };

  // Fetch current Meta configuration on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/meta/config');
      if (res.ok) {
        const data = await res.json();
        setPhoneId(data.whatsappPhoneNumberId || '');
        setWabaId(data.whatsappWabaId || '');
        setVerifyToken(data.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');
        setAppId(data.whatsappAppId || '');
        setAppSecret(data.whatsappAppSecret || '');
        setConnectionStatus(data.status || 'disconnected');
        setHasToken(data.hasAccessToken);
        setMaskedToken(data.maskedAccessToken || '');
        setLastConnectedAt(data.lastConnectedAt || null);
      }
    } catch (err) {
      console.error('Failed to fetch Meta config:', err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveAlert(null);

    try {
      const res = await fetch('/api/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappPhoneNumberId: phoneId,
          whatsappWabaId: wabaId,
          whatsappAccessToken: accessToken,
          whatsappVerifyToken: verifyToken,
          whatsappAppId: appId,
          whatsappAppSecret: appSecret,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveAlert({ type: 'success', message: 'Lưu cấu hình WhatsApp Cloud API thành công!' });
        setHasToken(data.hasAccessToken);
        if (accessToken) {
          setAccessToken(''); // Clear password input after save
        }
        await fetchConfig();
      } else {
        setSaveAlert({ type: 'error', message: data.error || 'Lỗi khi lưu cấu hình' });
      }
    } catch (err: any) {
      setSaveAlert({ type: 'error', message: err.message || 'Không thể kết nối đến server' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!testPhone) {
      setTestAlert({ type: 'error', message: 'Vui lòng nhập số điện thoại người nhận (ví dụ: 84901234567)' });
      return;
    }

    setIsTesting(true);
    setTestAlert(null);

    try {
      const res = await fetch('/api/meta/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: testPhone,
          messageText: testMessage || `[YumNetwork CRM Test] Xin chào! Kết nối WhatsApp Cloud API thành công vào lúc ${new Date().toLocaleString('vi-VN')}!`,
          phoneNumberId: phoneId,
          accessToken: accessToken || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestAlert({ type: 'success', message: data.message });
        setConnectionStatus('connected');
        if (data.lastConnectedAt) {
          setLastConnectedAt(data.lastConnectedAt);
        }
      } else {
        setTestAlert({ type: 'error', message: data.error || 'Gửi tin nhắn test thất bại' });
        setConnectionStatus('error');
      }
    } catch (err: any) {
      setTestAlert({ type: 'error', message: err.message || 'Lỗi kết nối API' });
      setConnectionStatus('error');
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 bg-slate-50 text-slate-900">
      {/* Live Status Badge */}
      <div className={`rounded-2xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm ${
        connectionStatus === 'connected'
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
          : connectionStatus === 'error'
          ? 'bg-red-50 border-red-300 text-red-900'
          : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            connectionStatus === 'connected' ? 'bg-emerald-600 text-white' : connectionStatus === 'error' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              Trạng thái Kết nối WhatsApp API:
              <span className="uppercase font-mono text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-white border border-current">
                {connectionStatus === 'connected' ? '🟢 ĐÃ KẾT NỐI (ACTIVE)' : connectionStatus === 'error' ? '🔴 LỖI KẾT NỐI' : '🟡 CHƯA KẾT NỐI'}
              </span>
            </h3>
            <p className="text-xs mt-0.5 opacity-90">
              {connectionStatus === 'connected'
                ? `Đã xác thực thành công. Lần kết nối gần nhất: ${lastConnectedAt ? new Date(lastConnectedAt).toLocaleString('vi-VN') : 'Mới đây'}`
                : connectionStatus === 'error'
                ? 'Vui lòng kiểm tra lại Access Token hoặc Phone Number ID bên dưới.'
                : 'Chưa có thông số Token/Phone ID hợp lệ. Hãy điền thông tin và bấm Lưu & Test.'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchConfig}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-300 transition cursor-pointer shrink-0 shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới trạng thái
        </button>
      </div>

      {/* Main Grid: Form Admin Config + Test Module */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Cấu hình WhatsApp API */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Key className="w-6 h-6 text-emerald-600" />
              Cấu Hình Xác Thực WhatsApp Cloud API (Admin Only)
            </h2>
          </div>

          {saveAlert && (
            <div className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              saveAlert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-red-50 text-red-800 border-red-300'
            }`}>
              {saveAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />}
              {saveAlert.message}
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  WhatsApp Phone Number ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 582910394812390"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-bold"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Lấy từ Meta Console &gt; WhatsApp &gt; Thiết lập API.</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  WhatsApp Business Account ID (WABA ID)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 109283948102934"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-bold"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">ID tài khoản kinh doanh WhatsApp.</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Permanent System Access Token (Mã Truy Cập Hệ Thống Meta) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder={hasToken ? `Đã lưu token (${maskedToken}). Nhập mới nếu muốn thay đổi...` : 'Nhập mã Bearer Token từ Meta System User...'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-bold"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Tạo Token không hết hạn trong Meta Business Settings &gt; System Users.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Webhook Verify Token (Dùng xác thực URL)
                </label>
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Meta App ID (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="App ID từ Meta Console"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-bold"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isSaving ? 'Đang Lưu...' : 'Lưu Cấu Hình WhatsApp API'}
              </button>
            </div>
          </form>

          {/* Webhook Callback Section */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              Thông Tin Điền Vào Mục Webhook Trên Meta Developer Console
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 block font-bold">Callback URL (Webhook)</span>
                  <code className="text-xs text-emerald-700 font-mono font-bold">{legalUrls.webhook}</code>
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
                  <span className="text-xs text-slate-500 block font-bold">Verify Token</span>
                  <code className="text-xs text-blue-600 font-mono font-bold">{verifyToken}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(verifyToken, 'verifyTokenVal')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-300 transition cursor-pointer shadow-xs"
                >
                  {copiedField === 'verifyTokenVal' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Token
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Module Test Kết Nối Trực Tiếp */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-lg flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-4">
              <Zap className="w-5 h-5 text-amber-500" />
              Kiểm Tra Kết Nối (Test Connection)
            </h2>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Nhập số điện thoại WhatsApp cá nhân của bạn để kiểm tra tính sẵn sàng của Token &amp; Phone Number ID vừa cài đặt.
            </p>

            {testAlert && (
              <div className={`p-3 rounded-xl text-xs font-bold border flex items-start gap-2 ${
                testAlert.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-red-50 text-red-900 border-red-300'
              }`}>
                {testAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />}
                <span>{testAlert.message}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Số điện thoại thử nghiệm (Bao gồm mã quốc gia 84)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 84901234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Nội dung tin nhắn test
                </label>
                <textarea
                  rows={3}
                  placeholder="[YumNetwork CRM Test] Xin chào! Kết nối WhatsApp Cloud API thành công..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isTesting ? 'Đang gửi tin nhắn test...' : 'Gửi Tin Nhắn WhatsApp Test Ngay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
