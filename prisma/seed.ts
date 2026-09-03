import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  INITIAL_CAMPAIGNS,
  INITIAL_CUSTOMERS,
  INITIAL_MESSAGES,
  INITIAL_PRODUCT_LIST,
  INITIAL_USERS,
} from '../src/data/mockData';

const prisma = new PrismaClient();

const DEFAULT_AUTOMATION_STEPS = [
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
];

async function main() {
  console.log('🌱 Đang bổ sung dữ liệu mẫu còn thiếu vào PostgreSQL...');
  console.log('🔒 Chế độ an toàn: không xóa và không ghi đè dữ liệu hiện có.');

  const automationSteps = await prisma.automationStep.createMany({
    data: DEFAULT_AUTOMATION_STEPS,
    skipDuplicates: true,
  });

  const adminEmail = process.env.ADMIN?.trim() || 'anh.nguyen@vietcrm.vn';
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || 'admin123';
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  const hashedDefaultPassword = await bcrypt.hash(adminPassword, 10);

  const users = await prisma.user.createMany({
    data: INITIAL_USERS.map((user) => {
      const isTargetAdmin = user.role === 'Admin' || user.id === 'usr_001';
      return {
        id: user.id,
        name: user.name,
        email: isTargetAdmin && process.env.ADMIN?.trim() ? adminEmail : user.email,
        password: isTargetAdmin ? hashedAdminPassword : hashedDefaultPassword,
        avatar: user.avatar || '',
        role: user.role,
        phone: user.phone || '',
        department: user.department,
        status: user.status,
        assignedLeadsCount: user.assignedLeadsCount || 0,
        totalRevenue: user.totalRevenue || 0,
      };
    }),
    skipDuplicates: true,
  });

  const products = await prisma.product.createMany({
    data: INITIAL_PRODUCT_LIST.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      price: product.price,
      costPrice: product.costPrice,
      stock: product.stock,
      status: product.status,
      sku: product.sku || product.code,
      description: product.description || '',
      image: product.image || '',
    })),
    skipDuplicates: true,
  });

  const customers = await prisma.customer.createMany({
    data: INITIAL_CUSTOMERS.map((customer) => ({
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      gender: customer.gender,
      address: customer.address,
      email: customer.email || null,
      note: customer.note || null,
      source: customer.source,
      campaign: customer.campaign,
      adSet: customer.adSet || null,
      landingPage: customer.landingPage || null,
      owner: customer.owner,
      status: customer.status,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      interestedProducts: customer.interestedProducts || [],
      whatsappOptIn: customer.whatsappOptIn,
      whatsappOptInDate: customer.whatsappOptInDate ? new Date(customer.whatsappOptInDate) : null,
      firstContact: new Date(customer.firstContact),
      lastContact: new Date(customer.lastContact),
    })),
    skipDuplicates: true,
  });

  const notes = await prisma.customerNote.createMany({
    data: INITIAL_CUSTOMERS.flatMap((customer) =>
      (customer.notes || []).map((note) => ({
        id: note.id,
        customerId: customer.id,
        author: note.author,
        content: note.content,
        type: note.type || 'note',
        createdAt: new Date(note.createdAt),
      })),
    ),
    skipDuplicates: true,
  });

  let createdOrders = 0;
  for (const customer of INITIAL_CUSTOMERS) {
    for (const order of customer.orders || []) {
      const existingOrder = await prisma.order.findFirst({
        where: { OR: [{ id: order.id }, { orderCode: order.orderCode }] },
        select: { id: true },
      });
      if (existingOrder) continue;

      await prisma.order.create({
        data: {
          id: order.id,
          orderCode: order.orderCode,
          customerId: customer.id,
          customerName: order.customerName || customer.name,
          customerPhone: order.customerPhone || customer.phone,
          date: new Date(order.date),
          totalAmount: order.totalAmount,
          status: order.status,
          notes: order.notes || '',
          products: {
            create: (order.products || []).map((product) => ({
              productName: product.productName,
              quantity: product.quantity,
              price: product.price,
            })),
          },
        },
      });
      createdOrders += 1;
    }
  }

  let createdAutomationLogs = 0;
  for (const customer of INITIAL_CUSTOMERS) {
    for (const log of customer.automationSequence?.logs || []) {
      const sentAt = new Date(log.sentAt);
      const existingLog = await prisma.automationLog.findFirst({
        where: {
          customerId: customer.id,
          step: log.step,
          sentAt,
        },
        select: { id: true },
      });
      if (existingLog) continue;

      await prisma.automationLog.create({
        data: {
          customerId: customer.id,
          step: log.step,
          stepName: log.stepName,
          sentAt,
          message: log.message,
          status: log.status,
        },
      });
      createdAutomationLogs += 1;
    }
  }

  const campaigns = await prisma.broadcastCampaign.createMany({
    data: INITIAL_CAMPAIGNS.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      targetGroup: campaign.targetGroup,
      targetProduct: campaign.targetProduct || null,
      targetCountry: campaign.targetCountry || null,
      category: campaign.category,
      messageTemplate: campaign.messageTemplate,
      status: campaign.status,
      totalTargeted: campaign.stats.totalTargeted,
      optedInCount: campaign.stats.optedInCount,
      sentCount: campaign.stats.sentCount,
      deliveredCount: campaign.stats.deliveredCount,
      readCount: campaign.stats.readCount,
      respondedCount: campaign.stats.respondedCount,
    })),
    skipDuplicates: true,
  });

  const messages = await prisma.whatsAppMessage.createMany({
    data: INITIAL_MESSAGES.map((message) => ({
      id: message.id,
      customerId: message.customerId,
      customerName: message.customerName,
      customerPhone: message.customerPhone,
      sender: message.sender === 'customer' ? 'customer' : 'agent',
      agentName: message.agentName || null,
      channel: message.channel || 'WhatsApp',
      content: message.content,
      isRead: message.isRead,
      readBy: message.readBy || null,
      readAt: message.readAt ? new Date(message.readAt) : null,
      timestamp: new Date(message.timestamp),
    })),
    skipDuplicates: true,
  });

  console.log('✅ Seed an toàn hoàn tất. Số bản ghi mới được bổ sung:');
  console.log({
    automationSteps: automationSteps.count,
    users: users.count,
    products: products.count,
    customers: customers.count,
    notes: notes.count,
    orders: createdOrders,
    automationLogs: createdAutomationLogs,
    campaigns: campaigns.count,
    messages: messages.count,
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
