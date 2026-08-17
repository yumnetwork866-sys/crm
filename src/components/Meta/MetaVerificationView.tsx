import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Send, 
  RefreshCw, 
  AlertTriangle, 
  Zap, 
  Phone,
  Check,
  Smartphone,
  Building2
} from 'lucide-react';

interface MetaVerificationViewProps {
  onNavigateLegal?: (page: 'privacy' | 'terms' | 'deletion') => void;
}

interface PhoneItem {
  id: string;
  verifiedName: string;
  displayPhoneNumber: string;
  qualityRating?: string;
  codeVerificationStatus?: string;
}

export const MetaVerificationView: React.FC<MetaVerificationViewProps> = () => {
  // Integration Config States
  const [wabaId, setWabaId] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [verifyToken, setVerifyToken] = useState('YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);

  // Phone Numbers List State
  const [phoneNumbersList, setPhoneNumbersList] = useState<PhoneItem[]>([]);
  const [isFetchingPhones, setIsFetchingPhones] = useState(false);
  const [fetchPhonesAlert, setFetchPhonesAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Test Connection States
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);
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
        setConnectionStatus(data.status || (data.hasAccessToken ? 'connected' : 'disconnected'));
        setLastConnectedAt(data.lastConnectedAt || null);

        // Auto fetch phone numbers from Meta WABA ID
        if (data.whatsappWabaId && data.hasAccessToken) {
          fetchPhoneNumbersList(data.whatsappWabaId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Meta config:', err);
    }
  };

  const fetchPhoneNumbersList = async (targetWabaId?: string) => {
    const waba = targetWabaId || wabaId;
    if (!waba) return;
    setIsFetchingPhones(true);
    setFetchPhonesAlert(null);

    try {
      const { ok, data } = await safeJsonFetch('/api/meta/fetch-phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wabaId: waba }),
      });

      if (ok && data.success) {
        setPhoneNumbersList(data.phoneNumbers || []);
        if (data.phoneNumbers.length > 0) {
          if (!phoneId) {
            setPhoneId(data.phoneNumbers[0].id);
          }
          setFetchPhonesAlert(null);
        } else {
          setFetchPhonesAlert({
            type: 'error',
            message: 'Không tìm thấy số điện thoại nào trong WABA ID này trên Meta.'
          });
        }
      } else {
        setFetchPhonesAlert({
          type: 'error',
          message: data.error || 'Không thể lấy danh sách số điện thoại từ Meta.'
        });
      }
    } catch (err: any) {
      setFetchPhonesAlert({
        type: 'error',
        message: err.message || 'Lỗi kết nối khi tải danh sách số điện thoại.'
      });
    } finally {
      setIsFetchingPhones(false);
    }
  };

  const handleSelectPhone = async (selectedId: string) => {
    setPhoneId(selectedId);
    try {
      await safeJsonFetch('/api/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappPhoneNumberId: selectedId,
          whatsappWabaId: wabaId,
          whatsappVerifyToken: verifyToken,
        }),
      });
    } catch (e) {
      console.error('Failed to update selected phone ID in DB:', e);
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

  const selectedPhoneItem = phoneNumbersList.find((p) => p.id === phoneId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 text-slate-900">
      
      {/* 1. Header Overview Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
            <h2 className="text-base font-bold text-slate-900">
              WhatsApp Cloud API (WABA)
            </h2>
        </div>

        <button
          onClick={() => { fetchConfig(); fetchPhoneNumbersList(); }}
          disabled={isFetchingPhones}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetchingPhones ? 'animate-spin' : ''}`} />
          <span>{isFetchingPhones ? 'Đang đồng bộ...' : 'Đồng bộ từ Meta'}</span>
        </button>
      </div>

      {/* 2. Main Two-Column Balanced Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* CỘT TRÁI: DANH SÁCH SỐ ĐIỆN THOẠI (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex-1 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  Số Điện Thoại Doanh Nghiệp
                </h3>

                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                  {phoneNumbersList.length} số khả dụng
                </span>
              </div>

              {fetchPhonesAlert && fetchPhonesAlert.type === 'error' && (
                <div className="p-3 rounded-xl text-xs font-medium border flex items-center gap-2 bg-red-50 text-red-800 border-red-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{fetchPhonesAlert.message}</span>
                </div>
              )}

              {/* Danh sách thẻ số điện thoại */}
              <div className="space-y-2.5">
                {phoneNumbersList.length > 0 ? (
                  phoneNumbersList.map((item) => {
                    const isSelected = phoneId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectPhone(item.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-50/50 border-emerald-400/80 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <Phone className="w-4 h-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 truncate">
                                {item.verifiedName}
                              </span>
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                {item.displayPhoneNumber}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                              ID: {item.id}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <Check className="w-3.5 h-3.5" />
                              Đang sử dụng
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:text-slate-700 hover:bg-slate-100">
                              Chọn
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-3">
                    <Smartphone className="w-7 h-7 text-slate-400 mx-auto" />
                    <div>
                      <p className="font-semibold text-xs text-slate-700">
                        {isFetchingPhones ? 'Đang kết nối Meta tải danh sách số...' : 'Đang lấy dữ liệu từ WABA ID...'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tự động sử dụng cấu hình từ file .env
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: TEST GỬI TIN NHANH (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Gửi Tin Nhắn Thử Nghiệm
                </h3>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200/60">
                  {selectedPhoneItem?.displayPhoneNumber || 'Số mặc định'}
                </span>
              </div>

              {testAlert && (
                <div className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2 ${
                  testAlert.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
                }`}>
                  {testAlert.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  )}
                  <span>{testAlert.message}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Số điện thoại nhận tin
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 84901234567"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nội dung tin nhắn test
                  </label>
                  <textarea
                    rows={3}
                    placeholder="[YumNetwork CRM Test] Xin chào! Kết nối WhatsApp Cloud API thành công..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !phoneId}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isTesting ? 'Đang gửi...' : 'Gửi Tin Nhắn Test'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
