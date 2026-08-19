import type { BusinessPhoneNumber, ConversationStatus } from './types';

export const DEFAULT_BUSINESS_PHONES: BusinessPhoneNumber[] = [
  {
    id: 'phone_601110716895',
    verifiedName: 'Yum Network WABA (Chính)',
    displayPhoneNumber: '+60 11-1071 6895',
    qualityRating: 'GREEN',
  },
  {
    id: 'phone_60123456789',
    verifiedName: 'Yum CSKH & Tư Vấn 01',
    displayPhoneNumber: '+60 12 345 6789',
    qualityRating: 'GREEN',
  },
  {
    id: 'phone_84988123456',
    verifiedName: 'Yum Hotline Việt Nam',
    displayPhoneNumber: '+84 988 123 456',
    qualityRating: 'GREEN',
  },
];

export const STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  consulting: { label: 'Đang tư vấn', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  ordered: { label: 'Đã chốt đơn', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  callback: { label: 'Hẹn gọi lại', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  completed: { label: 'Hoàn thành', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
};

export const QUICK_TEMPLATES = [
  { code: '/chao', title: 'Chào hỏi & Tư vấn', content: 'Dạ em chào anh/chị! Em là chuyên viên tư vấn từ YumNetwork. Em có thể hỗ trợ thông tin gì cho mình hôm nay ạ?' },
  { code: '/gia', title: 'Báo giá Combo Ưu đãi', content: '📄 BÁO GIÁ SẢN PHẨM:\n- Combo 2 Hộp Thảo Mộc: 700.000đ\n- Quà tặng: 1 Bình Giữ Nhiệt Cao Cấp\n- Miễn phí vận chuyển tận nhà (COD).' },
  { code: '/combo', title: 'Combo Mua 2 Tặng 1', content: '🔥 SIÊU ƯU ĐÃI THÁNG:\n- Mua 2 Hộp tặng ngay 1 Hộp cùng loại\n- Giảm thêm 50.000đ khi thanh toán trước\n- Giao hàng hỏa tốc trong 2-3 ngày.' },
  { code: '/stk', title: 'Thông tin Chuyển khoản', content: '💳 THÔNG TIN THANH TOÁN:\n- Ngân hàng: Techcombank\n- Số tài khoản: 190368889999\n- Chủ tài khoản: CÔNG TY TNHH YUM NETWORK\n- Nội dung: [Tên khách] + [SĐT]' },
  { code: '/freeship', title: 'Chính sách Vận chuyển & COD', content: '🚚 CHÍNH SÁCH VẬN CHUYỂN:\n- Miễn phí ship COD toàn quốc cho đơn từ 500k.\n- Khách được đồng kiểm hàng trước khi thanh toán.\n- Đổi trả 1-1 trong 7 ngày nếu lỗi sản phẩm.' },
  { code: '/voucher', title: 'Tặng Voucher 20%', content: '🏷️ MÃ GIẢM GIÁ ĐỘC QUYỀN:\n- Mã: YUMVIP20 (Giảm 20% tối đa 150k)\n- Hạn dùng: 7 ngày kể từ hôm nay\n- Áp dụng cho toàn bộ sản phẩm tại YumNetwork.' },
  { code: '/hdsd', title: 'Hướng dẫn sử dụng', content: '📋 HƯỚNG DẪN SỬ DỤNG:\n- Uống 1 gói/ngày sau bữa sáng 30 phút.\n- Pha cùng 150ml - 200ml nước ấm.\n- Duy trì đều đặn 1 liệu trình từ 3-4 tuần để thấy rõ hiệu quả.' },
] as const;

export const POPULAR_EMOJIS = ['👍', '❤️', '😊', '🙏', '🔥', '🎉', '👏', '💯', '✨', '💐', '👌', '⭐', '📦', '💬'];

export const EXTENDED_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '👏', '💯', '🥰', '😍',
  '🥳', '🤝', '🤩', '💪', '✨', '🌹', '💐', '👌', '😎', '🥺', '🙌', '😋',
  '🤔', '☕', '🍎', '🍰', '🎁', '⭐', '💥', '💖', '🤗', '😇', '🚀', '☀️',
  '🌸', '🥇', '🏆', '⚡', '🍀', '💎',
];
