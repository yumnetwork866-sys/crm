import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  AlertTriangle,
  Phone,
  Check,
  Smartphone,
  Building2,
  Link2,
  LoaderCircle,
  Plus,
} from 'lucide-react';
import { getStoredToken } from '../../utils/apiClient';

type EmbeddedSignupSession = {
  wabaId: string;
  phoneNumberId?: string;
  businessId?: string;
  mode: EmbeddedSignupMode;
};

type EmbeddedSignupMode = 'cloud_api' | 'coexistence';

type FacebookLoginResponse = {
  authResponse?: { code?: string; accessToken?: string };
  status?: string;
};

type EmbeddedSignupCredential = {
  code?: string;
  accessToken?: string;
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

function isTrustedFacebookOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:'
      && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com'));
  } catch {
    return false;
  }
}

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
  wabaId: string;
  wabaName?: string;
  verifiedName: string;
  displayPhoneNumber: string;
  profilePictureUrl?: string;
  qualityRating?: string;
  codeVerificationStatus?: string;
}

export const MetaVerificationView: React.FC<MetaVerificationViewProps> = () => {
  // Integration Config States
  const [phoneId, setPhoneId] = useState('');
  const [verifyToken, setVerifyToken] = useState('YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');
  const [metaAppId, setMetaAppId] = useState('');
  const [configurationId, setConfigurationId] = useState('');
  const [graphVersion, setGraphVersion] = useState('v26.0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingMode, setConnectingMode] = useState<EmbeddedSignupMode | null>(null);
  const [signupAlert, setSignupAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const signupCredentialRef = useRef<EmbeddedSignupCredential | null>(null);
  const signupSessionRef = useRef<EmbeddedSignupSession | null>(null);
  const isCompletingRef = useRef(false);
  const credentialWaitTimerRef = useRef<number | null>(null);
  const signupModeRef = useRef<EmbeddedSignupMode>('cloud_api');
  const isAwaitingPopupRef = useRef(false);

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

  const fetchPhoneNumbersList = useCallback(async () => {
    setIsFetchingPhones(true);
    setFetchPhonesAlert(null);

    try {
      const { ok, data } = await safeJsonFetch('/api/meta/business-phones');

      if (ok && data.success) {
        const phones: PhoneItem[] = data.phoneNumbers || [];
        setPhoneNumbersList(phones);
        if (phones.length > 0) {
          const selected = phones.find((phone) => phone.id === data.selectedPhoneNumberId) || phones[0];
          setPhoneId(selected.id);
          setFetchPhonesAlert(null);
        } else {
          setPhoneId('');
          setFetchPhonesAlert({
            type: 'error',
            message: 'Chưa có số WhatsApp Business nào được kết nối.'
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
  }, [safeJsonFetch]);

  const fetchConfig = useCallback(async () => {
    try {
      const { ok, data } = await safeJsonFetch('/api/meta/config');
      if (ok) {
        setPhoneId(data.whatsappPhoneNumberId || '');
        setVerifyToken(data.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026');
        setMetaAppId(data.embeddedSignup?.appId || '');
        setConfigurationId(data.embeddedSignup?.configurationId || '');
        setGraphVersion(data.embeddedSignup?.graphVersion || 'v26.0');

        await fetchPhoneNumbersList();
      }
    } catch (err) {
      console.error('Failed to fetch Meta config:', err);
    }
  }, [fetchPhoneNumbersList, safeJsonFetch]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const completeEmbeddedSignup = useCallback(async (credential: EmbeddedSignupCredential, session: EmbeddedSignupSession) => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    if (credentialWaitTimerRef.current !== null) {
      window.clearTimeout(credentialWaitTimerRef.current);
      credentialWaitTimerRef.current = null;
    }
    setIsConnecting(true);
    setSignupAlert(null);
    try {
      const { ok, data } = await safeJsonFetch('/api/meta/embedded-signup/complete', {
        method: 'POST',
        body: JSON.stringify({ ...credential, ...session }),
      });
      if (!ok) throw new Error(data.error || 'Không thể hoàn tất kết nối WhatsApp.');
      setSignupAlert({
        type: 'success',
        message: `Đã kết nối ${data.verifiedName || 'WhatsApp Business'}${data.displayPhoneNumber ? ` (${data.displayPhoneNumber})` : ''}.${
          Array.isArray(data.syncWarnings) && data.syncWarnings.length > 0
            ? ' Kết nối đã lưu nhưng đồng bộ dữ liệu cũ chưa khởi tạo đầy đủ; hãy kiểm tra cấu hình webhook.'
            : ''
        }`,
      });
      setPhoneId(data.phoneNumberId || session.phoneNumberId || '');
      await fetchPhoneNumbersList();
    } catch (error) {
      setSignupAlert({ type: 'error', message: error instanceof Error ? error.message : 'Không thể kết nối Meta.' });
    } finally {
      signupCredentialRef.current = null;
      signupSessionRef.current = null;
      isAwaitingPopupRef.current = false;
      isCompletingRef.current = false;
      setIsConnecting(false);
      setConnectingMode(null);
    }
  }, [fetchPhoneNumbersList, safeJsonFetch]);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      if (!isTrustedFacebookOrigin(event.origin)) return;
      let payload: any = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (payload.event === 'CANCEL') {
        if (credentialWaitTimerRef.current !== null) window.clearTimeout(credentialWaitTimerRef.current);
        credentialWaitTimerRef.current = null;
        isAwaitingPopupRef.current = false;
        signupCredentialRef.current = null;
        signupSessionRef.current = null;
        setIsConnecting(false);
        setConnectingMode(null);
        setSignupAlert({
          type: 'error',
          message: payload?.data?.error_message || 'Bạn đã đóng hoặc hủy quy trình kết nối WhatsApp.',
        });
        return;
      }
      if (payload.event === 'ERROR') {
        if (credentialWaitTimerRef.current !== null) window.clearTimeout(credentialWaitTimerRef.current);
        credentialWaitTimerRef.current = null;
        isAwaitingPopupRef.current = false;
        signupCredentialRef.current = null;
        signupSessionRef.current = null;
        setIsConnecting(false);
        setConnectingMode(null);
        setSignupAlert({ type: 'error', message: payload?.data?.error_message || 'Meta báo lỗi trong Embedded Signup.' });
        return;
      }
      const isCloudApiFinish = payload.event === 'FINISH';
      const isCoexistenceFinish = payload.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING';
      if (!isCloudApiFinish && !isCoexistenceFinish) {
        if (String(payload.event || '').startsWith('FINISH')) {
          if (credentialWaitTimerRef.current !== null) window.clearTimeout(credentialWaitTimerRef.current);
          credentialWaitTimerRef.current = null;
          isAwaitingPopupRef.current = false;
          signupCredentialRef.current = null;
          signupSessionRef.current = null;
          setIsConnecting(false);
          setConnectingMode(null);
          setSignupAlert({
            type: 'error',
            message: 'Luồng Meta đã hoàn tất nhưng chưa có số điện thoại. Hãy chạy lại và chọn hoặc thêm một số WhatsApp.',
          });
        }
        return;
      }
      const data = payload.data || {};
      const mode: EmbeddedSignupMode = isCoexistenceFinish ? 'coexistence' : signupModeRef.current;
      if (!data.waba_id || (mode === 'cloud_api' && !data.phone_number_id)) {
        if (credentialWaitTimerRef.current !== null) window.clearTimeout(credentialWaitTimerRef.current);
        credentialWaitTimerRef.current = null;
        isAwaitingPopupRef.current = false;
        signupCredentialRef.current = null;
        signupSessionRef.current = null;
        setIsConnecting(false);
        setConnectingMode(null);
        setSignupAlert({ type: 'error', message: 'Meta không trả về đủ WABA ID hoặc Phone Number ID.' });
        return;
      }
      signupSessionRef.current = {
        wabaId: String(data.waba_id),
        phoneNumberId: data.phone_number_id ? String(data.phone_number_id) : undefined,
        businessId: data.business_id ? String(data.business_id) : undefined,
        mode,
      };
      if (signupCredentialRef.current) {
        void completeEmbeddedSignup(signupCredentialRef.current, signupSessionRef.current);
      } else {
        if (credentialWaitTimerRef.current !== null) window.clearTimeout(credentialWaitTimerRef.current);
        credentialWaitTimerRef.current = window.setTimeout(() => {
          if (!signupCredentialRef.current && signupSessionRef.current && !isCompletingRef.current) {
            isAwaitingPopupRef.current = false;
            signupSessionRef.current = null;
            setIsConnecting(false);
            setConnectingMode(null);
            setSignupAlert({
              type: 'error',
              message: 'Meta đã hoàn tất chọn WABA nhưng không trả thông tin xác thực. Hãy kiểm tra loại token trong Facebook Login for Business Configuration.',
            });
          }
        }, 20_000);
      }
    };
    window.addEventListener('message', receiveMessage);
    return () => {
      window.removeEventListener('message', receiveMessage);
      if (credentialWaitTimerRef.current !== null) window.clearTimeout(credentialWaitTimerRef.current);
    };
  }, [completeEmbeddedSignup]);

  const startEmbeddedSignup = useCallback(async (mode: EmbeddedSignupMode) => {
    if (!metaAppId || !configurationId) {
      setSignupAlert({ type: 'error', message: 'Thiếu Meta App ID hoặc Embedded Signup Configuration ID.' });
      return;
    }
    flushSync(() => {
      setIsConnecting(true);
      setConnectingMode(mode);
      setSignupAlert(null);
    });
    signupModeRef.current = mode;
    isAwaitingPopupRef.current = true;
    signupCredentialRef.current = null;
    signupSessionRef.current = null;
    if (credentialWaitTimerRef.current !== null) {
      window.clearTimeout(credentialWaitTimerRef.current);
      credentialWaitTimerRef.current = null;
    }
    credentialWaitTimerRef.current = window.setTimeout(() => {
      if (!isAwaitingPopupRef.current || isCompletingRef.current) return;
      isAwaitingPopupRef.current = false;
      signupCredentialRef.current = null;
      signupSessionRef.current = null;
      setIsConnecting(false);
      setConnectingMode(null);
      setSignupAlert({
        type: 'error',
        message: 'Phiên kết nối Meta đã hết thời gian chờ. Hãy mở lại và thử lần nữa.',
      });
    }, 10 * 60_000);
    try {
      await loadFacebookSdk(metaAppId, graphVersion);
      if (!window.FB) throw new Error('Facebook SDK chưa sẵn sàng.');
      window.FB.login((response) => {
        const code = response.authResponse?.code?.trim() || '';
        const accessToken = response.authResponse?.accessToken?.trim() || '';
        if (!code && !accessToken) {
          // Meta can emit an interim `unknown` response as soon as the popup opens.
          // The authoritative outcome arrives through WA_EMBEDDED_SIGNUP postMessage.
          console.info('[META EMBEDDED SIGNUP] Đang chờ người dùng hoàn tất popup.', response.status || 'pending');
          return;
        }
        const credential: EmbeddedSignupCredential = code ? { code } : { accessToken };
        signupCredentialRef.current = credential;
        if (signupSessionRef.current) {
          void completeEmbeddedSignup(credential, signupSessionRef.current);
        }
      }, {
        config_id: configurationId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: mode === 'coexistence' ? 'whatsapp_business_app_onboarding' : '',
          sessionInfoVersion: '3',
        },
      });
    } catch (error) {
      if (credentialWaitTimerRef.current !== null) {
        window.clearTimeout(credentialWaitTimerRef.current);
        credentialWaitTimerRef.current = null;
      }
      isAwaitingPopupRef.current = false;
      setIsConnecting(false);
      setConnectingMode(null);
      setSignupAlert({ type: 'error', message: error instanceof Error ? error.message : 'Không thể mở Meta Embedded Signup.' });
    }
  }, [completeEmbeddedSignup, configurationId, graphVersion, metaAppId]);

  const handleSelectPhone = async (selectedId: string) => {
    const selectedPhone = phoneNumbersList.find((phone) => phone.id === selectedId);
    if (!selectedPhone) return;
    try {
      const { ok, data } = await safeJsonFetch('/api/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappPhoneNumberId: selectedId,
          whatsappWabaId: selectedPhone.wabaId,
          whatsappVerifyToken: verifyToken,
        }),
      });
      if (!ok) throw new Error(data.error || 'Không thể chọn số WhatsApp Business.');
      setPhoneId(selectedId);
    } catch (e) {
      console.error('Failed to update selected phone ID in DB:', e);
    }
  };

  const wabaGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name?: string; phones: PhoneItem[] }>();
    for (const phone of phoneNumbersList) {
      const group = groups.get(phone.wabaId) || { id: phone.wabaId, name: phone.wabaName, phones: [] };
      if (!group.name && phone.wabaName) group.name = phone.wabaName;
      group.phones.push(phone);
      groups.set(phone.wabaId, group);
    }
    return Array.from(groups.values());
  }, [phoneNumbersList]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 text-slate-900">

      {/* 1. Thêm / kết nối số */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Phương thức kết nối</h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-5">
          <div className="group rounded-2xl border border-slate-200 bg-white p-4 flex flex-col transition hover:border-blue-300 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <h4 className="truncate text-sm font-bold text-slate-900">Đăng ký Cloud API</h4>
              </div>
              <span className="mt-2 shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black tracking-wide text-blue-700">SỐ MỚI</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Dành cho số chưa có WhatsApp.</p>
            <button
              type="button"
              onClick={() => void startEmbeddedSignup('cloud_api')}
              disabled={isConnecting || !metaAppId || !configurationId}
              style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
              className="mt-4 py-2.5 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white! text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectingMode === 'cloud_api' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {connectingMode === 'cloud_api' ? 'Đang mở Meta...' : 'Bắt đầu thiết lập'}
            </button>
          </div>

          <div className="group rounded-2xl border border-slate-200 bg-white p-4 flex flex-col transition hover:border-emerald-300 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <h4 className="truncate text-sm font-bold text-slate-900">Kết nối số hiện tại</h4>
              </div>
              <span className="mt-2 shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black tracking-wide text-emerald-700">ĐANG DÙNG</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Tiếp tục dùng app WhatsApp Business.</p>
            <button
              type="button"
              onClick={() => void startEmbeddedSignup('coexistence')}
              disabled={isConnecting || !metaAppId || !configurationId}
              style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
              className="mt-4 py-2.5 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white! text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectingMode === 'coexistence' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {connectingMode === 'coexistence' ? 'Đang mở Meta...' : 'Kết nối ngay'}
            </button>
          </div>
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

      {/* 2. Danh Sách WABA & Số Điện Thoại */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Tài khoản WABA & Danh sách số
            </h3>

            {phoneNumbersList.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                {phoneNumbersList.length} số đã kết nối · {wabaGroups.length} WABA
              </span>
            )}
          </div>

          {fetchPhonesAlert && fetchPhonesAlert.type === 'error' && (
            <div className="p-3 rounded-xl text-xs font-medium border flex items-center gap-2 bg-red-50 text-red-800 border-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{fetchPhonesAlert.message}</span>
            </div>
          )}

          {phoneNumbersList.length > 0 ? (
            <div className="space-y-4">
              {wabaGroups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {group.name || 'Tài khoản WhatsApp Business (WABA)'}
                          </h4>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {group.phones.length} số
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-medium text-slate-500">WABA ID:</span>
                          <code className="text-xs px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold select-all font-mono">
                            {group.id}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    {group.phones.map((item) => {
                      const isSelected = phoneId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectPhone(item.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-emerald-600 text-white ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {item.profilePictureUrl ? (
                                <img
                                  src={item.profilePictureUrl}
                                  alt={`Ảnh đại diện ${item.verifiedName}`}
                                  className="h-full w-full rounded-lg object-cover"
                                />
                              ) : (
                                <Phone className="w-4 h-4" />
                              )}
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
                                Phone Number ID: {item.id}
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
                              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-lg border border-slate-200 transition">
                                Chọn
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-3">
              {isFetchingPhones ? (
                <div className="flex min-h-20 items-center justify-center" role="status" aria-label="Đang tải danh sách WhatsApp Business">
                  <LoaderCircle className="h-7 w-7 animate-spin text-emerald-600" />
                </div>
              ) : (
                <>
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <p className="font-semibold text-xs text-slate-700">
                      Chưa có tài khoản WABA nào được kết nối.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hãy chọn phương thức kết nối ở phía trên để liên kết WABA và các số điện thoại.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
