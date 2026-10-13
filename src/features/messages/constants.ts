import type { ConversationStatus, QuickTemplate } from './types';

export const STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  consulting: { label: 'Đang tư vấn', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  ordered: { label: 'Đã chốt đơn', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  callback: { label: 'Hẹn gọi lại', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  completed: { label: 'Hoàn thành', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
};

export const DEFAULT_QUICK_TEMPLATES: QuickTemplate[] = [
  { id: 'tmpl-chao', code: '/chao', title: 'Chào hỏi & Tư vấn', category: 'Tư vấn', content: 'Dạ em chào {ten_khach}! Em là {ten_nv} từ YumNetwork. Em có thể hỗ trợ thông tin gì cho mình hôm nay ạ?' },
  { id: 'tmpl-gia', code: '/gia', title: 'Báo giá Combo Ưu đãi', category: 'Báo giá', content: '📄 BÁO GIÁ SẢN PHẨM:\n- Combo 2 Hộp Thảo Mộc: 700.000đ\n- Quà tặng: 1 Bình Giữ Nhiệt Cao Cấp\n- Miễn phí vận chuyển tận nhà (COD).' },
  { id: 'tmpl-combo', code: '/combo', title: 'Combo Mua 2 Tặng 1', category: 'Ưu đãi', content: '🔥 SIÊU ƯU ĐÃI THÁNG:\n- Mua 2 Hộp tặng ngay 1 Hộp cùng loại\n- Giảm thêm 50.000đ khi thanh toán trước\n- Giao hàng hỏa tốc trong 2-3 ngày.' },
  { id: 'tmpl-stk', code: '/stk', title: 'Thông tin Chuyển khoản', category: 'Thanh toán', content: '💳 THÔNG TIN THANH TOÁN:\n- Ngân hàng: Techcombank\n- Số tài khoản: 190368889999\n- Chủ tài khoản: CÔNG TY TNHH YUM NETWORK\n- Nội dung: {ten_khach} + {sdt}' },
  { id: 'tmpl-freeship', code: '/freeship', title: 'Chính sách Vận chuyển & COD', category: 'Vận chuyển', content: '🚚 CHÍNH SÁCH VẬN CHUYỂN:\n- Miễn phí ship COD toàn quốc cho đơn từ 500k.\n- Khách được đồng kiểm hàng trước khi thanh toán.\n- Đổi trả 1-1 trong 7 ngày nếu lỗi sản phẩm.' },
  { id: 'tmpl-voucher', code: '/voucher', title: 'Tặng Voucher 20%', category: 'Ưu đãi', content: '🏷️ MÃ GIẢM GIÁ ĐỘC QUYỀN:\n- Mã: YUMVIP20 (Giảm 20% tối đa 150k)\n- Hạn dùng: 7 ngày kể từ hôm nay\n- Áp dụng cho toàn bộ sản phẩm tại YumNetwork.' },
  { id: 'tmpl-xacnhan', code: '/xacnhan', title: 'Xác nhận đơn hàng', category: 'Chốt đơn', content: '📦 XÁC NHẬN ĐƠN HÀNG:\n- Khách hàng: {ten_khach}\n- SĐT: {sdt}\n- Em đã tạo đơn cho mình rồi ạ. Khi shipper giao tới anh/chị nhớ đồng kiểm hàng nhé!' },
  { id: 'tmpl-hdsd', code: '/hdsd', title: 'Hướng dẫn sử dụng', category: 'CSKH', content: '📋 HƯỚNG DẪN SỬ DỤNG:\n- Uống 1 gói/ngày sau bữa sáng 30 phút.\n- Pha cùng 150ml - 200ml nước ấm.\n- Duy trì đều đặn 1 liệu trình từ 3-4 tuần để thấy rõ hiệu quả.' },
];

export const QUICK_TEMPLATES = DEFAULT_QUICK_TEMPLATES;

export const POPULAR_EMOJIS = ['👍', '❤️', '😊', '🙏', '🔥', '🎉', '👏', '💯', '✨', '💐', '👌', '⭐', '📦', '💬'];

export const EXTENDED_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '👏', '💯', '🥰', '😍',
  '🥳', '🤝', '🤩', '💪', '✨', '🌹', '💐', '👌', '😎', '🥺', '🙌', '😋',
  '🤔', '☕', '🍎', '🍰', '🎁', '⭐', '💥', '💖', '🤗', '😇', '🚀', '☀️',
  '🌸', '🥇', '🏆', '⚡', '🍀', '💎',
];
