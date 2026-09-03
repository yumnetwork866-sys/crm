import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { INITIAL_CUSTOMERS, INITIAL_CAMPAIGNS, INITIAL_USERS, INITIAL_PRODUCT_LIST, INITIAL_MESSAGES } from '../src/data/mockData';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Đang khởi tạo dữ liệu mẫu cho PostgreSQL database...');

  // 1. Clear existing records
  await prisma.whatsAppMessage.deleteMany();
  await prisma.automationLog.deleteMany();
  await prisma.automationStep.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.broadcastCampaign.deleteMany();

  console.log('✅ Đã dọn dẹp bảng dữ liệu cũ.');

  await prisma.automationStep.createMany({
    data: [
      {
        id: 'step_1',
        step: 1,
        dayOffset: 3,
        title: 'Ngày +3: Lời Cảm Ơn & HDSD',
        defaultMsg: 'Chào {{Customer Name}}, VietCRM xin gửi lời cảm ơn chân thành bạn đã tin dùng sản phẩm. Nhấp vào liên kết sau để xem video hướng dẫn sử dụng chuẩn spa nhé!',
        iconName: 'Heart',
        color: '#e11d48',
        active: true,
      },
      {
        id: 'step_2',
        step: 2,
        dayOffset: 5,
        title: 'Ngày +5: Hỏi Trải Nghiệm',
        defaultMsg: 'Chào {{Customer Name}}, bạn đã dùng sản phẩm được 5 ngày rồi. Làn da/mái tóc của bạn có cảm thấy mượt mà và dịu nhẹ hơn chưa? Hãy chia sẻ với bọn mình nhé!',
        iconName: 'MessageCircle',
        color: '#d97706',
        active: true,
      },
      {
        id: 'step_3',
        step: 3,
        dayOffset: 7,
        title: 'Ngày +7: Giải Đáp & Gợi Ý SP',
        defaultMsg: 'Chào {{Customer Name}}, nếu có bất kỳ thắc mắc nào khi kết hợp sản phẩm, đừng ngần ngại hỏi nhé! Ngoài ra, kết hợp cùng Serum Vitamin C sẽ nhân đôi hiệu quả đấy ạ.',
        iconName: 'HelpCircle',
        color: '#2563eb',
        active: true,
      },
      {
        id: 'step_4',
        step: 4,
        dayOffset: 15,
        title: 'Ngày +15: Gửi Voucher & Mua Lại',
        defaultMsg: 'Chào {{Customer Name}}, tặng bạn Voucher VIP20OFF giảm 20% cho đơn hàng tiếp theo. Mã có hiệu lực trong 7 ngày tới, đặt ngay nhé!',
        iconName: 'Gift',
        color: '#059669',
        active: true,
      },
    ],
  });

  // 2. Seed Users
  const adminEmail = process.env.ADMIN?.trim() || 'anh.nguyen@vietcrm.vn';
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || 'admin123';
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  const hashedDefaultPassword = await bcrypt.hash(adminPassword, 10);

  for (const u of INITIAL_USERS) {
    const isTargetAdmin = u.role === 'Admin' || u.id === 'usr_001';
    const userEmail = isTargetAdmin && process.env.ADMIN?.trim() ? process.env.ADMIN.trim() : u.email;
    const userPassword = isTargetAdmin ? hashedAdminPassword : hashedDefaultPassword;

    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        email: userEmail,
        password: userPassword,
        avatar: u.avatar || '',
        role: u.role,
        phone: u.phone || '',
        department: u.department,
        status: u.status,
        assignedLeadsCount: u.assignedLeadsCount || 0,
        totalRevenue: u.totalRevenue || 0
      }
    });
  }
  console.log(`✅ Đã nạp ${INITIAL_USERS.length} tài khoản người dùng (Admin: ${adminEmail}, Mật khẩu: ${adminPassword}).`);

  // 3. Seed Products
  for (const p of INITIAL_PRODUCT_LIST) {
    await prisma.product.create({
      data: {
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        price: p.price,
        costPrice: p.costPrice,
        stock: p.stock,
        status: p.status,
        sku: p.sku || p.code,
        description: p.description || '',
        image: p.image || ''
      }
    });
  }
  console.log(`✅ Đã nạp ${INITIAL_PRODUCT_LIST.length} sản phẩm.`);

  // 4. Seed Customers & Notes & Orders
  for (const c of INITIAL_CUSTOMERS) {
    const createdCustomer = await prisma.customer.create({
      data: {
        id: c.id,
        phone: c.phone,
        name: c.name,
        gender: c.gender,
        address: c.address,
        email: c.email || null,
        note: c.note || null,
        source: c.source,
        campaign: c.campaign,
        adSet: c.adSet || null,
        landingPage: c.landingPage || null,
        owner: c.owner,
        status: c.status,
        totalOrders: c.totalOrders,
        totalSpent: c.totalSpent,
        interestedProducts: c.interestedProducts || [],
        whatsappOptIn: c.whatsappOptIn,
        whatsappOptInDate: c.whatsappOptInDate ? new Date(c.whatsappOptInDate) : null,
        firstContact: new Date(c.firstContact),
        lastContact: new Date(c.lastContact)
      }
    });

    // Notes
    if (c.notes && c.notes.length > 0) {
      for (const note of c.notes) {
        await prisma.customerNote.create({
          data: {
            id: note.id,
            customerId: createdCustomer.id,
            author: note.author,
            content: note.content,
            type: note.type || 'note',
            createdAt: new Date(note.createdAt)
          }
        });
      }
    }

    // Orders
    if (c.orders && c.orders.length > 0) {
      for (const ord of c.orders) {
        await prisma.order.create({
          data: {
            id: ord.id,
            orderCode: ord.orderCode,
            customerId: createdCustomer.id,
            customerName: ord.customerName || createdCustomer.name,
            customerPhone: ord.customerPhone || createdCustomer.phone,
            date: new Date(ord.date),
            totalAmount: ord.totalAmount,
            status: ord.status,
            notes: ord.notes || '',
            products: {
              create: (ord.products || []).map(p => ({
                productName: p.productName,
                quantity: p.quantity,
                price: p.price
              }))
            }
          }
        });
      }
    }

    // Automation Logs
    if (c.automationSequence?.logs) {
      for (const log of c.automationSequence.logs) {
        await prisma.automationLog.create({
          data: {
            customerId: createdCustomer.id,
            step: log.step,
            stepName: log.stepName,
            sentAt: new Date(log.sentAt),
            message: log.message,
            status: log.status
          }
        });
      }
    }
  }
  console.log(`✅ Đã nạp ${INITIAL_CUSTOMERS.length} khách hàng kèm lịch sử đơn hàng và ghi chú.`);

  // 5. Seed Broadcast Campaigns
  for (const cmp of INITIAL_CAMPAIGNS) {
    await prisma.broadcastCampaign.create({
      data: {
        id: cmp.id,
        name: cmp.name,
        targetGroup: cmp.targetGroup,
        targetProduct: cmp.targetProduct || null,
        targetCountry: cmp.targetCountry || null,
        category: cmp.category,
        messageTemplate: cmp.messageTemplate,
        status: cmp.status,
        totalTargeted: cmp.stats.totalTargeted,
        optedInCount: cmp.stats.optedInCount,
        sentCount: cmp.stats.sentCount,
        deliveredCount: cmp.stats.deliveredCount,
        readCount: cmp.stats.readCount,
        respondedCount: cmp.stats.respondedCount
      }
    });
  }
  console.log(`✅ Đã nạp ${INITIAL_CAMPAIGNS.length} chiến dịch broadcast mẫu.`);

  // 6. Seed WhatsApp Messages
  for (const msg of INITIAL_MESSAGES) {
    await prisma.whatsAppMessage.create({
      data: {
        id: msg.id,
        customerId: msg.customerId,
        customerName: msg.customerName,
        customerPhone: msg.customerPhone,
        sender: msg.sender === 'customer' ? 'customer' : 'agent',
        agentName: msg.agentName || null,
        channel: msg.channel || 'WhatsApp',
        content: msg.content,
        isRead: msg.isRead,
        readBy: msg.readBy || null,
        readAt: msg.readAt ? new Date(msg.readAt) : null,
        timestamp: new Date(msg.timestamp)
      }
    });
  }
  console.log(`✅ Đã nạp ${INITIAL_MESSAGES.length} tin nhắn mẫu.`);

  console.log('🎉 Hoàn tất nạp dữ liệu mẫu vào PostgreSQL!');
}

main()
  .catch(e => {
    console.error('❌ Lỗi khi nạp seed data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
