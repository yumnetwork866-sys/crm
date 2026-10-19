export const WHATSAPP_UNREACHABLE_ERROR_CODE = '131026';

export function getWhatsAppErrorDetails(error: any): string | null {
  const details = error?.error_data?.details;
  if (typeof details === 'string' && details.trim()) return details.trim();
  if (details !== undefined && details !== null) {
    try {
      return JSON.stringify(details);
    } catch {
      return String(details);
    }
  }
  return null;
}

export function getWhatsAppDeliveryErrorMessage(error: any): string {
  const code = Number(error?.code ?? error?.error_subcode);
  if (code === 131047) {
    return 'Quá 24 giờ kể từ tin nhắn cuối của khách. Hãy dùng tin nhắn mẫu (template).';
  }
  if (code === Number(WHATSAPP_UNREACHABLE_ERROR_CODE)) {
    return 'Meta không thể giao tin nhắn đến người nhận này. Tài khoản có thể không còn hoạt động, chưa chấp nhận điều khoản, ứng dụng quá cũ hoặc đã chặn doanh nghiệp.';
  }
  if (code === 190) {
    return 'Access Token của Meta đã hết hạn hoặc bị hủy quyền.';
  }
  return error?.message || error?.error_user_msg || error?.title || 'Meta từ chối gửi tin nhắn.';
}
