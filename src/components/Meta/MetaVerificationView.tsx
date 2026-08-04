import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Key, 
  Send, 
  RefreshCw, 
  AlertTriangle, 
  Zap, 
  Radio, 
  Phone,
  Search
} from 'lucide-react';

interface MetaVerificationViewProps {
  onNavigateLegal?: (page: 'privacy' | 'terms' | 'deletion') => void;
}

export const MetaVerificationView: React.FC<MetaVerificationViewProps> = () => {
  // Integration Config States
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [verifyToken, setVerifyToken] = useState('YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [hasToken, setHasToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState('');
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);

  // Auto Fetch Phone Numbers State
  const [phoneNumbersList, setPhoneNumbersList] = useState<Array<{ id: string; verifiedName: string; displayPhoneNumber: string }>>([]);
  const [isFetchingPhones, setIsFetchingPhones] = useState(false);
  const [fetchPhonesAlert, setFetchPhonesAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Test Connection States
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveAlert, setSaveAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testAlert, setTestAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const safeJsonFetch = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`Phản hồi từ Server không đúng định dạng JSON (Mã lỗi ${res.status}).`);
    }
    return { ok: res.ok, status: res.status, data };
  };

  // Fetch current Meta configuration on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { ok, data } = await safeJsonFetch('/api/meta/config');
      if (ok) {
        setPhoneId(data.whatsappPhoneNumberId || '');
        setWabaId(data.whatsappWabaId || '');
        setVerifyToken(data.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');
        setConnectionStatus(data.status || 'disconnected');
        setHasToken(data.hasAccessToken);
        setMaskedToken(data.maskedAccessToken || '');
        setLastConnectedAt(data.lastConnectedAt || null);

        // Auto fetch phone numbers list if WABA ID & token exist
        if (data.whatsappWabaId && data.hasAccessToken) {
          fetchPhoneNumbersList(data.whatsappWabaId, '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch Meta config:', err);
    }
  };

  const fetchPhoneNumbersList = async (wabaIdToFetch: string, tokenToFetch: string) => {
    if (!wabaIdToFetch) return;
    setIsFetchingPhones(true);
    setFetchPhonesAlert(null);

    try {
      const { ok, data } = await safeJsonFetch('/api/meta/fetch-phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wabaId: wabaIdToFetch, accessToken: tokenToFetch }),
      });

      if (ok && data.success) {
        setPhoneNumbersList(data.phoneNumbers);
        setFetchPhonesAlert({ type: 'success', message: `Đã tìm thấy ${data.count} số điện thoại trong WABA ID!` });
        if (data.phoneNumbers.length > 0 && !phoneId) {
          setPhoneId(data.phoneNumbers[0].id);
        }
      } else {
        setFetchPhonesAlert({ type: 'error', message: data.error || 'Không thể tải danh sách số điện thoại từ Meta WABA.' });
      }
    } catch (err: any) {
      setFetchPhonesAlert({ type: 'error', message: err.message || 'Lỗi kết nối khi tải số điện thoại.' });
    } finally {
      setIsFetchingPhones(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveAlert(null);

    try {
      const { ok, data } = await safeJsonFetch('/api/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappPhoneNumberId: phoneId,
          whatsappWabaId: wabaId,
          whatsappAccessToken: accessToken,
          whatsappVerifyToken: verifyToken,
        }),
      });

      if (ok) {
        setSaveAlert({ type: 'success', message: 'Lưu cấu hình WhatsApp API thành công!' });
        setHasToken(data.hasAccessToken);
        if (accessToken) {
          setAccessToken('');
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
      const { ok, data } = await safeJsonFetch('/api/meta/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: testPhone,
          messageText: testMessage || `[YumNetwork CRM Test] Xin chào! Kết nối WhatsApp Cloud API thành công vào lúc ${new Date().toLocaleString('vi-VN')}!`,
          phoneNumberId: phoneId,
          accessToken: accessToken || undefined,
        }),
      });

      if (ok && data.success) {
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
                : 'Hãy điền WABA ID & Permanent Access Token rồi bấm Tải Số Điện Thoại.'}
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
              Cấu Hình WhatsApp Cloud API Qua WABA ID (Tự Động Nối Số)
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

          <form onSubmit={handleSaveConfig} className="space-y-5">
            {/* Step 1: WABA ID & Access Token */}
            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-emerald-600" />
                Bước 1: Nhập Mã Doanh Nghiệp WABA ID &amp; Token Meta:
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>WhatsApp Business Account ID (WABA ID) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-500 font-normal lowercase">Meta Business Settings &gt; WhatsApp Accounts</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 109283948102934"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Permanent Access Token (Mã Truy Cập Hệ Thống Meta) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-500 font-normal lowercase">Business Settings &gt; System Users</span>
                </label>
                <input
                  type="password"
                  placeholder={hasToken ? `Đã lưu token (${maskedToken}). Nhập mới nếu muốn thay đổi...` : 'Nhập mã Bearer Token vĩnh viễn từ Meta...'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold shadow-xs"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => fetchPhoneNumbersList(wabaId, accessToken)}
                  disabled={isFetchingPhones || !wabaId}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isFetchingPhones ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-emerald-400" />}
                  {isFetchingPhones ? 'Đang tải số điện thoại...' : ' Tải Tự Động Danh Sách Số Điện Thoại Từ WABA ID'}
                </button>
              </div>

              {fetchPhonesAlert && (
                <div className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                  fetchPhonesAlert.type === 'success' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-red-100 text-red-900 border-red-300'
                }`}>
                  {fetchPhonesAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />}
                  {fetchPhonesAlert.message}
                </div>
              )}
            </div>

            {/* Step 2: Select Phone Number from WABA */}
            <div className="bg-emerald-50/60 p-4.5 rounded-2xl border border-emerald-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  Bước 2: Chọn Số Điện Thoại Sử Dụng Gửi Tin Nhắn:
                </div>
                {phoneNumbersList.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Tìm thấy {phoneNumbersList.length} số
                  </span>
                )}
              </div>

              {phoneNumbersList.length > 0 ? (
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Danh Sách Số Điện Thoại Thuộc WABA ID Của Bạn:
                  </label>
                  <select
                    value={phoneId}
                    onChange={(e) => setPhoneId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                  >
                    {phoneNumbersList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.verifiedName} ({p.displayPhoneNumber}) — Phone ID: {p.id}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    WhatsApp Phone Number ID (Hoặc nhập ID thủ công nếu biết):
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 582910394812390"
                    value={phoneId}
                    onChange={(e) => setPhoneId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold shadow-xs"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Bấm nút "Tải Tự Động Danh Sách..." ở trên để hệ thống tự lấy danh sách số.</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isSaving ? 'Đang Lưu Cấu Hình...' : 'Lưu Cấu Hình WhatsApp API'}
              </button>
            </div>
          </form>
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
