// API Client wrapper for YumNetwork CRM Frontend

const API_BASE_URL = '/api';

export function clearLegacyStoredTokens() {
  localStorage.removeItem('yumnetwork_crm_jwt_token');
  localStorage.removeItem('vietcrm_jwt_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const legacyToken = localStorage.getItem('yumnetwork_crm_jwt_token')
    || localStorage.getItem('vietcrm_jwt_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {}),
    ...(options.headers as Record<string, string>)
  };

  const method = options.method || 'GET';
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'same-origin',
      headers
    });
  } catch (error) {
    console.error(`[API NETWORK ERROR] ${method} ${endpoint}`, error);
    throw error;
  }

  if (response.status === 401) {
    // Chỉ token không hợp lệ/hết hạn mới kết thúc phiên; 403 chỉ là thiếu quyền.
    if (endpoint !== '/auth/login') {
      clearLegacyStoredTokens();
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data.error === 'string'
      ? data.error
      : data.error?.message || data.message || `Yêu cầu thất bại với mã lỗi ${response.status}`;
    console.error(`[API ERROR] ${method} ${endpoint} -> ${response.status}`, {
      statusText: response.statusText,
      message,
    });
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
};
