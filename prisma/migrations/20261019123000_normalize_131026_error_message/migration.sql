UPDATE "WhatsAppMessage"
SET "errorMessage" = 'Meta không thể giao tin nhắn đến người nhận này. Tài khoản có thể không còn hoạt động, chưa chấp nhận điều khoản, ứng dụng quá cũ hoặc đã chặn doanh nghiệp.'
WHERE "errorCode" = '131026';
