import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { normalizePhoneE164 } from '../server/utils/phone';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

const DEFAULT_AUTOMATION_STEPS = [
  {
    id: 'step_1',
    step: 1,
    dayOffset: 3,
    title: 'Lời Cảm Ơn & HDSD',
    defaultMsg: 'Chào {{Customer Name}}, YumNetwork CRM xin gửi lời cảm ơn chân thành bạn đã tin dùng sản phẩm. Nhấp vào liên kết sau để xem video hướng dẫn sử dụng chuẩn spa nhé!',
    iconName: 'Heart',
    color: '#e11d48',
    active: true,
  },
  {
    id: 'step_2',
    step: 2,
    dayOffset: 5,
    title: 'Hỏi Trải Nghiệm',
    defaultMsg: 'Chào {{Customer Name}}, bạn đã dùng sản phẩm được 5 ngày rồi. Làn da/mái tóc của bạn có cảm thấy mượt mà và dịu nhẹ hơn chưa? Hãy chia sẻ với bọn mình nhé!',
    iconName: 'MessageCircle',
    color: '#d97706',
    active: true,
  },
  {
    id: 'step_3',
    step: 3,
    dayOffset: 7,
    title: 'Giải Đáp & Gợi Ý SP',
    defaultMsg: 'Chào {{Customer Name}}, nếu có bất kỳ thắc mắc nào khi kết hợp sản phẩm, đừng ngần ngại hỏi nhé! Ngoài ra, kết hợp cùng Serum Vitamin C sẽ nhân đôi hiệu quả đấy ạ.',
    iconName: 'HelpCircle',
    color: '#2563eb',
    active: true,
  },
  {
    id: 'step_4',
    step: 4,
    dayOffset: 15,
    title: 'Gửi Voucher & Mua Lại',
    defaultMsg: 'Chào {{Customer Name}}, tặng bạn Voucher VIP20OFF giảm 20% cho đơn hàng tiếp theo. Mã có hiệu lực trong 7 ngày tới, đặt ngay nhé!',
    iconName: 'Gift',
    color: '#059669',
    active: true,
  },
];

async function main() {
  console.log('🌱 Đang khởi tạo dữ liệu cấu hình cơ bản vào PostgreSQL...');
  console.log('🔒 Chế độ an toàn: không xóa và không ghi đè dữ liệu hiện có.');

  const automationSteps = await prisma.automationStep.createMany({
    data: DEFAULT_AUTOMATION_STEPS,
    skipDuplicates: true,
  });

  const adminEmail = process.env.ADMIN?.trim() || 'anh.nguyen@yumnetwork.vn';
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || 'admin123';
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

  const users = await prisma.user.createMany({
    data: [
      {
        id: 'usr_001',
        name: 'Quản trị viên',
        email: adminEmail,
        password: hashedAdminPassword,
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff',
        role: 'Admin',
        phone: normalizePhoneE164('0901000111'),
        status: 'active',
        assignedLeadsCount: 0,
        totalRevenue: 0,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed an toàn hoàn tất. Số bản ghi mới được bổ sung:');
  console.log({
    automationSteps: automationSteps.count,
    users: users.count,
  });
}

main()
  .catch((error) => {
    console.error('❌ Lỗi khi nạp seed data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
