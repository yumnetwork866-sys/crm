import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  RefreshCw, 
  AlertTriangle, 
  Phone,
  Check,
  Smartphone,
  Building2,
  Link2,
  LoaderCircle,
} from 'lucide-react';
import { getStoredToken } from '../../utils/apiClient';

type EmbeddedSignupSession = {
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
};

type FacebookLoginResponse = {
  authResponse?: { code?: string };
  status?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let facebookSdkPromise: Promise<void> | null = null;

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  if (window.FB) {
    window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
    return Promise.resolve();
  }
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve();
    };
    const existing = document.getElementById('facebook-jssdk');
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => {
      facebookSdkPromise = null;
      reject(new Error('Không thể tải Facebook JavaScript SDK.'));
    };
    document.head.appendChild(script);
  });
  return facebookSdkPromise;
}

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
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [metaAppId, setMetaAppId] = useState(import.meta.env.VITE_META_APP_ID || '2066680650914544');
  const [configurationId, setConfigurationId] = useState(
    import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID || '1980841189284400',
  );
  const [graphVersion, setGraphVersion] = useState(import.meta.env.VITE_META_GRAPH_VERSION || 'v26.0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [signupAlert, setSignupAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const signupCodeRef = useRef('');
  const signupSessionRef = useRef<EmbeddedSignupSession | null>(null);
  const isCompletingRef = useRef(false);

  // Phone Numbers List State
  const [phoneNumbersList, setPhoneNumbersList] = useState<PhoneItem[]>([]);
  const [isFetchingPhones, setIsFetchingPhones] = useState(false);
  const [fetchPhonesAlert, setFetchPhonesAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const safeJsonFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = getStoredToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers || {}),
      },
    });
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
        setConnectionStatus(data.status || 'disconnected');
        setMetaAppId(data.embeddedSignup?.appId || import.meta.env.VITE_META_APP_ID || '2066680650914544');
        setConfigurationId(data.embeddedSignup?.configurationId || import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID || '1980841189284400');
        setGraphVersion(data.embeddedSignup?.graphVersion || import.meta.env.VITE_META_GRAPH_VERSION || 'v26.0');

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

  const completeEmbeddedSignup = useCallback(async (code: string, session: EmbeddedSignupSession) => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setIsConnecting(true);
    setSignupAlert(null);
    try {
      const { ok, data } = await safeJsonFetch('/api/meta/embedded-signup/complete', {
        method: 'POST',
        body: JSON.stringify({ code, ...session }),
      });
      if (!ok) throw new Error(data.error || 'Không thể hoàn tất kết nối WhatsApp.');
      setSignupAlert({
        type: 'success',
        message: `Đã kết nối ${data.verifiedName || 'WhatsApp Business'}${data.displayPhoneNumber ? ` (${data.displayPhoneNumber})` : ''}.`,
      });
      setWabaId(data.wabaId || session.wabaId);
      setPhoneId(data.phoneNumberId || session.phoneNumberId);
      setConnectionStatus('connected');
      await fetchPhoneNumbersList(data.wabaId || session.wabaId);
    } catch (error) {
      setSignupAlert({ type: 'error', message: error instanceof Error ? error.message : 'Không thể kết nối Meta.' });
    } finally {
      signupCodeRef.current = '';
      signupSessionRef.current = null;
      isCompletingRef.current = false;
      setIsConnecting(false);
    }
  }, [fetchPhoneNumbersList, safeJsonFetch]);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      let payload: any = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (payload.event === 'CANCEL') {
        setIsConnecting(false);
        setSignupAlert({ type: 'error', message: 'Bạn đã đóng hoặc hủy quy trình kết nối WhatsApp.' });
        return;
      }
      if (payload.event === 'ERROR') {
        setIsConnecting(false);
        setSignupAlert({ type: 'error', message: payload?.data?.error_message || 'Meta báo lỗi trong Embedded Signup.' });
        return;
      }
      if (payload.event !== 'FINISH') return;
      const data = payload.data || {};
      if (!data.waba_id || !data.phone_number_id) {
        setSignupAlert({ type: 'error', message: 'Meta không trả về WABA ID hoặc Phone Number ID.' });
        return;
      }
      signupSessionRef.current = {
        wabaId: String(data.waba_id),
        phoneNumberId: String(data.phone_number_id),
        businessId: data.business_id ? String(data.business_id) : undefined,
      };
      if (signupCodeRef.current) {
        void completeEmbeddedSignup(signupCodeRef.current, signupSessionRef.current);
      }
    };
    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, [completeEmbeddedSignup]);

  const startEmbeddedSignup = useCallback(async () => {
    if (!metaAppId || !configurationId) {
      setSignupAlert({ type: 'error', message: 'Thiếu Meta App ID hoặc Embedded Signup Configuration ID.' });
      return;
    }
    setIsConnecting(true);
    setSignupAlert(null);
    signupCodeRef.current = '';
    signupSessionRef.current = null;
    try {
      await loadFacebookSdk(metaAppId, graphVersion);
      if (!window.FB) throw new Error('Facebook SDK chưa sẵn sàng.');
      window.FB.login((response) => {
        const code = response.authResponse?.code?.trim() || '';
        if (!code) {
          setIsConnecting(false);
          setSignupAlert({ type: 'error', message: 'Meta không trả về authorization code hoặc người dùng đã hủy.' });
          return;
        }
        signupCodeRef.current = code;
        if (signupSessionRef.current) {
          void completeEmbeddedSignup(code, signupSessionRef.current);
        }
      }, {
        config_id: configurationId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' },
      });
    } catch (error) {
      setIsConnecting(false);
      setSignupAlert({ type: 'error', message: error instanceof Error ? error.message : 'Không thể mở Meta Embedded Signup.' });
    }
  }, [completeEmbeddedSignup, configurationId, graphVersion, metaAppId]);

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

      {/* 2. Embedded Signup */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">Meta Embedded Signup</h3>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {connectionStatus === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kết nối hoặc thay đổi WhatsApp Business Account qua quy trình chính thức của Meta.
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                App {metaAppId || '—'} · Config {configurationId || '—'} · {graphVersion}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void startEmbeddedSignup()}
            disabled={isConnecting || !metaAppId || !configurationId}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isConnecting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {isConnecting
              ? 'Đang kết nối...'
              : connectionStatus === 'connected'
                ? 'Kết nối WABA khác'
                : 'Kết nối với Meta'}
          </button>
        </div>

        {signupAlert && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            signupAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {signupAlert.type === 'success'
              ? <Check className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{signupAlert.message}</span>
          </div>
        )}
      </div>

      {/* 3. Danh Sách Số Điện Thoại */}
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
                    Hãy kết nối WABA qua Meta Embedded Signup ở phía trên.
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
