import React, { useCallback, useEffect, useState } from 'react';
import { 
  RefreshCw, 
  AlertTriangle, 
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

  // Phone Numbers List State
  const [phoneNumbersList, setPhoneNumbersList] = useState<PhoneItem[]>([]);
  const [isFetchingPhones, setIsFetchingPhones] = useState(false);
  const [fetchPhonesAlert, setFetchPhonesAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const safeJsonFetch = useCallback(async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (cause) {
      throw new Error(`Phản hồi từ Server không đúng định dạng JSON (Mã lỗi ${res.status}).`, { cause });
    }
    return { ok: res.ok, status: res.status, data };
  }, []);

  const fetchPhoneNumbersList = useCallback(async (targetWabaId?: string) => {
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
          setPhoneId((current) => current || data.phoneNumbers[0].id);
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
  }, [safeJsonFetch, wabaId]);

  const fetchConfig = useCallback(async () => {
    try {
      const { ok, data } = await safeJsonFetch('/api/meta/config');
      if (ok) {
        setPhoneId(data.whatsappPhoneNumberId || '');
        setWabaId(data.whatsappWabaId || '');
        setVerifyToken(data.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');

        if (data.whatsappWabaId && data.hasAccessToken) {
          await fetchPhoneNumbersList(data.whatsappWabaId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Meta config:', err);
    }
  }, [fetchPhoneNumbersList, safeJsonFetch]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

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
          onClick={() => {
            void fetchConfig();
            void fetchPhoneNumbersList();
          }}
          disabled={isFetchingPhones}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetchingPhones ? 'animate-spin' : ''}`} />
          <span>{isFetchingPhones ? 'Đang đồng bộ...' : 'Đồng bộ từ Meta'}</span>
        </button>
      </div>

      {/* 2. Danh Sách Số Điện Thoại */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
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
  );
};
