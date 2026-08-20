import type { Customer, BroadcastCampaign, MarketingCampaignReport, AppUser, Product, CentralMessage } from '../types';

export const INITIAL_PRODUCT_LIST: Product[] = [
  {
    id: 'prd_001',
    code: 'SP-COL-01',
    name: 'Kem Dưỡng Da Collagen Premium',
    category: 'Mỹ Phẩm',
    price: 1800000,
    costPrice: 720000,
    stock: 120,
    status: 'In Stock',
    sku: 'SKU-COL-50ML',
    description: 'Kem dưỡng bổ sung Collagen mờ nếp nhăn, tái tạo làn da căng bóng mịn màng.',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=300'
  },
  {
    id: 'prd_002',
    code: 'SP-VITC-02',
    name: 'Serum Vitamin C Sáng Da',
    category: 'Mỹ Phẩm',
    price: 1000000,
    costPrice: 400000,
    stock: 85,
    status: 'In Stock',
    sku: 'SKU-VITC-30ML',
    description: 'Serum chứa 15% Vitamin C tinh khiết giúp giảm thâm nám, đều màu da cấp tốc.',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=300'
  },
  {
    id: 'prd_003',
    code: 'SP-HAIR-03',
    name: 'Bộ Chăm Sóc Tóc Thảo Dược',
    category: 'Mỹ Phẩm',
    price: 850000,
    costPrice: 320000,
    stock: 14,
    status: 'Low Stock',
    sku: 'SKU-HERBAL-SET',
    description: 'Bộ gội xả bồ kết thảo dược tự nhiên giảm gãy rụng, kích thích mọc tóc.',
    image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=300'
  },
  {
    id: 'prd_004',
    code: 'SP-CLEAN-04',
    name: 'Sữa Rửa Mặt Nhẹ Dịu Balance',
    category: 'Mỹ Phẩm',
    price: 450000,
    costPrice: 180000,
    stock: 200,
    status: 'In Stock',
    sku: 'SKU-FACE-WASH',
    description: 'Sữa rửa mặt pH 5.5 dịu nhẹ không gây khô rát, làm sạch sâu lỗ chân lông.',
    image: 'https://images.unsplash.com/photo-1556228722-d119f01b1232?auto=format&fit=crop&q=80&w=300'
  },
  {
    id: 'prd_005',
    code: 'SP-ULTRA-05',
    name: 'Máy Rửa Mặt Ultrasonic Pro',
    category: 'Gia Dụng',
    price: 2500000,
    costPrice: 1100000,
    stock: 8,
    status: 'Low Stock',
    sku: 'SKU-DEV-ULTRA',
    description: 'Thiết bị làm sạch bằng sóng siêu âm 12,000 nhịp/phút chuẩn Spa tại nhà.',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=300'
  },
  {
    id: 'prd_006',
    code: 'SP-LIP-06',
    name: 'Son Dưỡng Ẩm Hồng Tự Nhiên',
    category: 'Mỹ Phẩm',
    price: 350000,
    costPrice: 120000,
    stock: 0,
    status: 'Out of Stock',
    sku: 'SKU-LIP-PINK',
    description: 'Son dưỡng lên màu nhẹ nhàng tự nhiên với tinh dầu jojoba và bơ hạt mỡ.',
    image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=300'
  },
  {
    id: 'prd_007',
    code: 'SP-SUN-07',
    name: 'Kem Chống Nắng SPF50+ PA++++',
    category: 'Mỹ Phẩm',
    price: 680000,
    costPrice: 280000,
    stock: 95,
    status: 'In Stock',
    sku: 'SKU-SUN-50ML',
    description: 'Kem chống nắng nâng tông nhẹ, chống tia UVA/UVB và ánh sáng xanh.',
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=300'
  }
];

export const INITIAL_PRODUCTS = INITIAL_PRODUCT_LIST.map(p => p.name);

export const SALES_REPS = [
  'Nguyễn Văn Ánh',
  'Trần Thu Hà',
  'Lê Hoàng Nam',
  'Phạm Minh Đức',
  'Vũ Thị Hương',
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_001',
    phone: '0908123456',
    name: 'Nguyễn Thị Minh Châu',
    gender: 'Nữ',
    address: 'Jalan Ampang, 50450 Kuala Lumpur, Malaysia',
    email: 'minhchau.nguyen@gmail.com',
    note: 'Khách VIP da nhạy cảm, thích tư vấn mỹ phẩm chống lão hóa',
    source: 'Facebook',
    campaign: 'Tet Sale 2026 - Beauty',
    adSet: 'Interest Skincare 25-40',
    landingPage: '/combo-tet-collagen',
    firstContact: '2026-07-01',
    lastContact: '2026-07-22',
    owner: 'Nguyễn Văn Ánh',
    status: 'Won',
    notes: [
      { id: 'n1', author: 'Nguyễn Văn Ánh', content: 'Khách quan tâm bộ Kem Dưỡng + Serum. Đã chốt combo 2,800,000đ.', createdAt: '2026-07-02 10:15', type: 'call' },
      { id: 'n2', author: 'Hệ Thống', content: 'Khách mua đơn đầu tiên thành công!', createdAt: '2026-07-02 11:00', type: 'system' },
      { id: 'n3', author: 'Nguyễn Văn Ánh', content: 'Đã mua tiếp lần 2 sau khi nhận voucher Day+15!', createdAt: '2026-07-20 14:30', type: 'whatsapp' }
    ],
    totalOrders: 3,
    totalSpent: 8500000,
    lastPurchaseDate: '2026-07-20',
    interestedProducts: ['Kem Dưỡng Da Collagen Premium', 'Serum Vitamin C Sáng Da'],
    whatsappOptIn: true,
    whatsappOptInDate: '2026-07-01',
    orders: [
      {
        id: 'ord_101',
        orderCode: 'DH-20260702-01',
        date: '2026-07-02',
        totalAmount: 2800000,
        status: 'Completed',
        products: [
          { productName: 'Kem Dưỡng Da Collagen Premium', quantity: 1, price: 1800000 },
          { productName: 'Serum Vitamin C Sáng Da', quantity: 1, price: 1000000 }
        ]
      },
      {
        id: 'ord_102',
        orderCode: 'DH-20260710-04',
        date: '2026-07-10',
        totalAmount: 2200000,
        status: 'Completed',
        products: [
          { productName: 'Bộ Chăm Sóc Tóc Thảo Dược', quantity: 2, price: 1100000 }
        ]
      },
      {
        id: 'ord_103',
        orderCode: 'DH-20260720-09',
        date: '2026-07-20',
        totalAmount: 3500000,
        status: 'Completed',
        products: [
          { productName: 'Máy Rửa Mặt Ultrasonic Pro', quantity: 1, price: 3500000 }
        ]
      }
    ],
    automationSequence: {
      active: true,
      currentStep: 4,
      startDate: '2026-07-02',
      logs: [
        { step: 1, stepName: 'Ngày +3 (Lời cảm ơn)', sentAt: '2026-07-05 09:00', message: 'Cảm ơn chị Châu đã ủng hộ VietCRM! Dưới đây là hướng dẫn sử dụng Kem Dưỡng Collagen...', status: 'Read' },
        { step: 2, stepName: 'Ngày +5 (Hỏi trải nghiệm)', sentAt: '2026-07-07 10:00', message: 'Chào chị Châu, chị dùng sản phẩm thấy làn da có cải thiện ẩm mượt hơn chưa ạ?', status: 'Read' },
        { step: 3, stepName: 'Ngày +7 (Giải đáp & Gợi ý)', sentAt: '2026-07-09 14:00', message: 'Để nhân đôi hiệu quả, chị có thể kết hợp thêm Serum Vitamin C nhé!', status: 'Read' },
        { step: 4, stepName: 'Ngày +15 (Gửi Voucher)', sentAt: '2026-07-17 09:30', message: 'Tặng chị Châu Voucher GIAM20% cho đơn hàng tiếp theo. Mã: VIPCHA20', status: 'Read' }
      ]
    }
  },
  {
    id: 'cust_002',
    phone: '0987654321',
    name: 'Trần Hoài Nam',
    gender: 'Nam',
    address: 'Bandar Sunway, 47500 Subang Jaya, Selangor, Malaysia',
    email: 'nam.tran@gmail.com',
    note: 'Thắc mắc về thời gian giao hàng tại Selangor',
    source: 'TikTok',
    campaign: 'TikTok Shop Live FlashSale',
    adSet: 'GenZ Beauty Trends',
    landingPage: '/serum-sang-da',
    firstContact: '2026-07-15',
    lastContact: '2026-07-22',
    owner: 'Trần Thu Hà',
    status: 'Contacted',
    notes: [
      { id: 'n201', author: 'Trần Thu Hà', content: 'Khách để lại SĐT từ TikTok Live. Đã nhắn zalo gửi bảng giá serum.', createdAt: '2026-07-15 16:20', type: 'whatsapp' }
    ],
    totalOrders: 0,
    totalSpent: 0,
    interestedProducts: ['Serum Vitamin C Sáng Da'],
    whatsappOptIn: true,
    whatsappOptInDate: '2026-07-15',
    orders: []
  },
  {
    id: 'cust_003',
    phone: '0912999888',
    name: 'Lê Thanh Thảo',
    gender: 'Nữ',
    address: 'Georgetown, 10040 Penang, Malaysia',
    email: 'thao.lethanh@yahoo.com',
    note: 'Chỉ giao hàng được giờ hành chính',
    source: 'Google',
    campaign: 'Google Search Branded Skincare',
    adSet: 'Exact Match Brand',
    landingPage: '/trang-chu',
    firstContact: '2026-07-18',
    lastContact: '2026-07-21',
    owner: 'Lê Hoàng Nam',
    status: 'Won',
    notes: [
      { id: 'n301', author: 'Lê Hoàng Nam', content: 'Khách tìm kiếm từ Google, đã mua 1 Bộ Chăm Sóc Tóc Thảo Dược.', createdAt: '2026-07-18 11:30', type: 'call' }
    ],
    totalOrders: 1,
    totalSpent: 1100000,
    lastPurchaseDate: '2026-07-18',
    interestedProducts: ['Bộ Chăm Sóc Tóc Thảo Dược'],
    whatsappOptIn: true,
    whatsappOptInDate: '2026-07-18',
    orders: [
      {
        id: 'ord_301',
        orderCode: 'DH-20260718-02',
        date: '2026-07-18',
        totalAmount: 1100000,
        status: 'Completed',
        products: [
          { productName: 'Bộ Chăm Sóc Tóc Thảo Dược', quantity: 1, price: 1100000 }
        ]
      }
    ],
    automationSequence: {
      active: true,
      currentStep: 1,
      startDate: '2026-07-18',
      logs: [
        { step: 1, stepName: 'Ngày +3 (Lời cảm ơn)', sentAt: '2026-07-21 09:00', message: 'Cảm ơn chị Thảo đã mua Bộ Chăm Sóc Tóc Thảo Dược! Gợi ý dùng gội xả kết hợp...', status: 'Delivered' }
      ]
    }
  },
  {
    id: 'cust_004',
    phone: '+1 415 555 2671',
    name: 'David Nguyen',
    gender: 'Nam',
    address: 'Mont Kiara, 50480 Kuala Lumpur, Malaysia',
    email: 'david.nguyen.ca@gmail.com',
    note: 'Yêu cầu gói quà & xuất hóa đơn công ty',
    source: 'Facebook',
    campaign: 'Overseas Vietnamese Retargeting',
    adSet: 'USA West Coast',
    landingPage: '/ship-us-skincare',
    firstContact: '2026-07-10',
    lastContact: '2026-07-21',
    owner: 'Phạm Minh Đức',
    status: 'Won',
    notes: [
      { id: 'n401', author: 'Phạm Minh Đức', content: 'Khách ở KL, chuyển khoản mua 2 máy rửa mặt gửi quà cho người thân.', createdAt: '2026-07-10 20:00', type: 'whatsapp' }
    ],
    totalOrders: 2,
    totalSpent: 7000000,
    lastPurchaseDate: '2026-07-21',
    interestedProducts: ['Máy Rửa Mặt Ultrasonic Pro', 'Kem Chống Nắng SPF50+ PA++++'],
    whatsappOptIn: true,
    whatsappOptInDate: '2026-07-10',
    orders: [
      {
        id: 'ord_401',
        orderCode: 'DH-20260710-09',
        date: '2026-07-10',
        totalAmount: 3500000,
        status: 'Completed',
        products: [
          { productName: 'Máy Rửa Mặt Ultrasonic Pro', quantity: 1, price: 3500000 }
        ]
      },
      {
        id: 'ord_402',
        orderCode: 'DH-20260721-03',
        date: '2026-07-21',
        totalAmount: 3500000,
        status: 'Completed',
        products: [
          { productName: 'Máy Rửa Mặt Ultrasonic Pro', quantity: 1, price: 3500000 }
        ]
      }
    ],
    automationSequence: {
      active: true,
      currentStep: 2,
      startDate: '2026-07-21',
      logs: []
    }
  },
  {
    id: 'cust_005',
    phone: '0977112233',
    name: 'Phạm Bích Phương',
    gender: 'Nữ',
    address: 'Johor Bahru, 80000 Johor, Malaysia',
    email: 'phuong.pb@gmail.com',
    note: 'Đang cân nhắc kem chống nắng cho da dầu',
    source: 'Website',
    campaign: 'Organic Organic SEO',
    landingPage: '/khuyen-mai-thang-7',
    firstContact: '2026-07-23',
    lastContact: '2026-07-23',
    owner: 'Vũ Thị Hương',
    status: 'New Lead',
    notes: [
      { id: 'n501', author: 'Hệ Thống', content: 'Khách hàng đăng ký form tư vấn trên Website.', createdAt: '2026-07-23 08:30', type: 'system' }
    ],
    totalOrders: 0,
    totalSpent: 0,
    interestedProducts: ['Kem Chống Nắng SPF50+ PA++++'],
    whatsappOptIn: false,
    orders: []
  },
  {
    id: 'cust_006',
    phone: '0933445566',
    name: 'Hoàng Anh Tuấn',
    gender: 'Nam',
    address: 'Ipoh, 30000 Perak, Malaysia',
    email: 'tuan.hoanganh@hotmail.com',
    note: 'Đã báo giá Sữa Rửa Mặt Balance qua WhatsApp',
    source: 'TikTok',
    campaign: 'TikTok Shop Live FlashSale',
    adSet: 'Men Skincare Interest',
    landingPage: '/srm-balance',
    firstContact: '2026-07-08',
    lastContact: '2026-07-12',
    owner: 'Nguyễn Văn Ánh',
    status: 'Quoted',
    notes: [
      { id: 'n601', author: 'Nguyễn Văn Ánh', content: 'Khách hỏi giá Sữa Rửa Mặt Balance. Đã gửi báo giá 450,000đ nhưng chưa phản hồi.', createdAt: '2026-07-08 15:40', type: 'whatsapp' }
    ],
    totalOrders: 0,
    totalSpent: 0,
    interestedProducts: ['Sữa Rút Mặt Nhẹ Dịu Balance'],
    whatsappOptIn: true,
    whatsappOptInDate: '2026-07-08',
    orders: []
  },
  {
    id: 'cust_007',
    phone: '+60 12 345 6789',
    name: 'Sato Kenji',
    gender: 'Nam',
    address: 'Kota Kinabalu, 88000 Sabah, Malaysia',
    email: 'kenji.sato@tokyo-beauty.jp',
    note: 'Khách cần ship hỏa tốc sang Đông Malaysia (Sabah)',
    source: 'Facebook',
    campaign: 'Japan Cross-Border Ad',
    adSet: 'Tokyo & Osaka Expats',
    landingPage: '/japan-shipping',
    firstContact: '2026-07-05',
    lastContact: '2026-07-19',
    owner: 'Trần Thu Hà',
    status: 'Won',
    notes: [
      { id: 'n701', author: 'Trần Thu Hà', content: 'Khách mua quà biếu, 1 đơn hàng trọn bộ.', createdAt: '2026-07-05 18:00', type: 'call' }
    ],
    totalOrders: 1,
    totalSpent: 4200000,
    lastPurchaseDate: '2026-07-05',
    interestedProducts: ['Kem Dưỡng Da Collagen Premium', 'Máy Rửa Mặt Ultrasonic Pro'],
    whatsappOptIn: true,
    whatsappOptInDate: '2026-07-05',
    orders: [
      {
        id: 'ord_701',
        orderCode: 'DH-20260705-12',
        date: '2026-07-05',
        totalAmount: 4200000,
        status: 'Completed',
        products: [
          { productName: 'Kem Dưỡng Da Collagen Premium', quantity: 1, price: 1800000 },
          { productName: 'Serum Vitamin C Sáng Da', quantity: 1, price: 1000000 },
          { productName: 'Son Dưỡng Ẩm Hồng Tự Nhiên', quantity: 2, price: 700000 }
        ]
      }
    ]
  },
  {
    id: 'cust_008',
    phone: '0966554433',
    name: 'Đặng Ngọc Kim Anh',
    gender: 'Nữ',
    address: 'Melaka City, 75000 Melaka, Malaysia',
    email: 'kimanh.dng@gmail.com',
    note: 'Khách thân thiết mua định kỳ mỗi tháng',
    source: 'Zalo',
    campaign: 'Zalo OA Official Feed',
    firstContact: '2026-06-15',
    lastContact: '2026-07-22',
    owner: 'Lê Hoàng Nam',
    status: 'Won',
    notes: [
      { id: 'n801', author: 'Lê Hoàng Nam', content: 'Khách quen mua hàng định kỳ mỗi tháng.', createdAt: '2026-07-01 10:00', type: 'note' }
    ],
    totalOrders: 4,
    totalSpent: 12400000,
    lastPurchaseDate: '2026-07-15',
    interestedProducts: ['Kem Dưỡng Da Collagen Premium', 'Son Dưỡng Ẩm Hồng Tự Nhiên'],
    whatsappOptIn: true,
    whatsappOptInDate: '2026-06-15',
    orders: [
      { id: 'o1', orderCode: 'DH-20260615-01', date: '2026-06-15', totalAmount: 2500000, status: 'Completed', products: [{ productName: 'Kem Dưỡng Da Collagen Premium', quantity: 1, price: 1800000 }, { productName: 'Son Dưỡng Ẩm Hồng Tự Nhiên', quantity: 2, price: 700000 }] },
      { id: 'o2', orderCode: 'DH-20260628-05', date: '2026-06-28', totalAmount: 3200000, status: 'Completed', products: [{ productName: 'Máy Rửa Mặt Ultrasonic Pro', quantity: 1, price: 3200000 }] },
      { id: 'o3', orderCode: 'DH-20260705-08', date: '2026-07-05', totalAmount: 3200000, status: 'Completed', products: [{ productName: 'Bộ Chăm Sóc Tóc Thảo Dược', quantity: 2, price: 1600000 }] },
      { id: 'o4', orderCode: 'DH-20260715-11', date: '2026-07-15', totalAmount: 3500000, status: 'Completed', products: [{ productName: 'Kem Dưỡng Da Collagen Premium', quantity: 2, price: 3500000 }] }
    ]
  }
];

export const INITIAL_CAMPAIGNS: BroadcastCampaign[] = [
  {
    id: 'bc_01',
    name: 'Tri Ân Khách VIP - Flash Sale 30%',
    targetGroup: 'VIP (Mua ≥ 2 lần)',
    category: 'Flash Sale',
    messageTemplate: 'Chào {{Customer Name}}, VietCRM xin tặng riêng bạn mã FLASH30 giảm 30% cho bộ sản phẩm Serum mới ra mắt!',
    createdAt: '2026-07-15 10:00',
    status: 'Completed',
    stats: {
      totalTargeted: 120,
      optedInCount: 115,
      sentCount: 115,
      deliveredCount: 112,
      readCount: 98,
      respondedCount: 34
    }
  },
  {
    id: 'bc_02',
    name: 'Gửi Voucher Khách Chưa Chốt Đơn',
    targetGroup: 'Đã hỏi giá',
    category: 'Voucher',
    messageTemplate: 'Chào {{Customer Name}}, bạn còn phân vân sản phẩm? Nhập ngay VOUCHER100K giảm trực tiếp 100.000đ khi chốt đơn hôm nay nhé!',
    createdAt: '2026-07-20 14:00',
    status: 'Completed',
    stats: {
      totalTargeted: 85,
      optedInCount: 78,
      sentCount: 78,
      deliveredCount: 76,
      readCount: 61,
      respondedCount: 18
    }
  }
];

export const INITIAL_MARKETING_REPORTS: MarketingCampaignReport[] = [
  { campaignName: 'Tet Sale 2026 - Beauty', source: 'Facebook', leadsCount: 142, adSpend: 15000000, revenue: 68000000, cpl: 105633, roas: 4.53 },
  { campaignName: 'TikTok Shop Live FlashSale', source: 'TikTok', leadsCount: 210, adSpend: 18000000, revenue: 52000000, cpl: 85714, roas: 2.88 },
  { campaignName: 'Google Search Branded', source: 'Google', leadsCount: 98, adSpend: 8000000, revenue: 42000000, cpl: 81632, roas: 5.25 },
  { campaignName: 'Zalo OA Official Feed', source: 'Zalo', leadsCount: 65, adSpend: 4000000, revenue: 21000000, cpl: 61538, roas: 5.25 },
  { campaignName: 'Organic SEO Website', source: 'Website', leadsCount: 112, adSpend: 0, revenue: 38000000, cpl: 0, roas: 99.00 }
];

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'usr_001',
    name: 'Nguyễn Văn Ánh',
    email: 'anh.nguyen@vietcrm.vn',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    role: 'Admin',
    phone: '0909123456',
    department: 'Ban Giám Đốc',
    status: 'active',
    lastActive: 'Đang hoạt động',
    assignedLeadsCount: 12,
    totalRevenue: 28500000,
  },
  {
    id: 'usr_002',
    name: 'Trần Thu Hà',
    email: 'ha.tran@vietcrm.vn',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250',
    role: 'Sales Manager',
    phone: '0918234567',
    department: 'Phòng Sales',
    status: 'active',
    lastActive: '10 phút trước',
    assignedLeadsCount: 18,
    totalRevenue: 42000000,
  },
  {
    id: 'usr_003',
    name: 'Lê Hoàng Nam',
    email: 'nam.le@vietcrm.vn',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
    role: 'Sales Rep',
    phone: '0987112233',
    department: 'Phòng Sales',
    status: 'active',
    lastActive: '1 giờ trước',
    assignedLeadsCount: 15,
    totalRevenue: 13500000,
  },
  {
    id: 'usr_004',
    name: 'Phạm Minh Đức',
    email: 'duc.pham@vietcrm.vn',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
    role: 'Marketing Lead',
    phone: '0933998877',
    department: 'Phòng Marketing',
    status: 'active',
    lastActive: '5 phút trước',
    assignedLeadsCount: 8,
    totalRevenue: 7000000,
  },
  {
    id: 'usr_005',
    name: 'Vũ Thị Hương',
    email: 'huong.vu@vietcrm.vn',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
    role: 'Customer Support',
    phone: '0977665544',
    department: 'Chăm Sóc Khách Hàng',
    status: 'inactive',
    lastActive: 'Hôm qua',
    assignedLeadsCount: 5,
    totalRevenue: 0,
  }
];

export const INITIAL_MESSAGES: CentralMessage[] = [
  // --- Khách hàng 1: Nguyễn Thị Minh Châu (cust_001) ---
  {
    id: 'msg_001',
    customerId: 'cust_001',
    customerName: 'Nguyễn Thị Minh Châu',
    customerPhone: '0908123456',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Chào shop, mình thấy quảng cáo bộ Kem Dưỡng Collagen với Serum Vitamin C trên Facebook, da mình nhạy cảm thì dùng có hợp không?',
    timestamp: '2026-07-01T09:15:00.000Z',
    isRead: true,
    readBy: 'Nguyễn Văn Ánh',
    readAt: '2026-07-01T09:16:00.000Z'
  },
  {
    id: 'msg_002',
    customerId: 'cust_001',
    customerName: 'Nguyễn Thị Minh Châu',
    customerPhone: '0908123456',
    sender: 'agent',
    agentName: 'Nguyễn Văn Ánh',
    channel: 'WhatsApp',
    content: 'Dạ chào chị Minh Châu ạ! Bộ sản phẩm bên em chiết xuất thiên nhiên lành tính, không cồn hay hương liệu nồng, hoàn toàn an toàn và dịu nhẹ cho da nhạy cảm chị nhé.',
    timestamp: '2026-07-01T09:18:00.000Z',
    isRead: true
  },
  {
    id: 'msg_003',
    customerId: 'cust_001',
    customerName: 'Nguyễn Thị Minh Châu',
    customerPhone: '0908123456',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Giá combo 2 món này bao nhiêu vậy bạn? Có ưu đãi freeship sang Kuala Lumpur không?',
    timestamp: '2026-07-01T09:20:00.000Z',
    isRead: true,
    readBy: 'Nguyễn Văn Ánh',
    readAt: '2026-07-01T09:21:00.000Z'
  },
  {
    id: 'msg_004',
    customerId: 'cust_001',
    customerName: 'Nguyễn Thị Minh Châu',
    customerPhone: '0908123456',
    sender: 'agent',
    agentName: 'Nguyễn Văn Ánh',
    channel: 'WhatsApp',
    content: 'Dạ combo Kem Collagen (1.800.000đ) + Serum Vitamin C (1.000.000đ) tổng 2.800.000đ. Hôm nay bên em đang có ưu đãi tặng kèm 1 nước hoa hồng mini và freeship tận nơi tại Jalan Ampang, KL cho chị ạ!',
    timestamp: '2026-07-01T09:25:00.000Z',
    isRead: true
  },
  {
    id: 'msg_005',
    customerId: 'cust_001',
    customerName: 'Nguyễn Thị Minh Châu',
    customerPhone: '0908123456',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Ok ship cho mình combo này về địa chỉ Jalan Ampang nhé!',
    timestamp: '2026-07-01T09:30:00.000Z',
    isRead: true,
    readBy: 'Nguyễn Văn Ánh',
    readAt: '2026-07-01T09:31:00.000Z'
  },
  {
    id: 'msg_006',
    customerId: 'cust_001',
    customerName: 'Nguyễn Thị Minh Châu',
    customerPhone: '0908123456',
    sender: 'agent',
    agentName: 'Nguyễn Văn Ánh',
    channel: 'WhatsApp',
    content: 'Dạ em đã lên đơn DH-20260702-01 cho chị rồi ạ. Cảm ơn chị Châu nhiều, hàng sẽ được đóng gói giao ngay hôm nay ạ!',
    timestamp: '2026-07-01T09:32:00.000Z',
    isRead: true
  },

  // --- Khách hàng 2: Trần Hoài Nam (cust_002) ---
  {
    id: 'msg_010',
    customerId: 'cust_002',
    customerName: 'Trần Hoài Nam',
    customerPhone: '0987654321',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Hi shop, mình xem livestream trên TikTok thấy giới thiệu Serum Vitamin C, bên mình có giao gấp về khu Bandar Sunway, Selangor được không?',
    timestamp: '2026-07-15T16:10:00.000Z',
    isRead: true,
    readBy: 'Trần Thu Hà',
    readAt: '2026-07-15T16:12:00.000Z'
  },
  {
    id: 'msg_011',
    customerId: 'cust_002',
    customerName: 'Trần Hoài Nam',
    customerPhone: '0987654321',
    sender: 'agent',
    agentName: 'Trần Thu Hà',
    channel: 'WhatsApp',
    content: 'Chào anh Nam! Bên em có hỗ trợ ship hỏa tốc trong 1-2 ngày tới khu vực Selangor anh nhé. Chai Serum Vitamin C đang có giá ưu đãi là 1.000.000đ ạ.',
    timestamp: '2026-07-15T16:15:00.000Z',
    isRead: true
  },
  {
    id: 'msg_012',
    customerId: 'cust_002',
    customerName: 'Trần Hoài Nam',
    customerPhone: '0987654321',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Serum này dùng buổi sáng trước khi ra ngoài có cần bôi thêm kem chống nắng không shop?',
    timestamp: '2026-07-22T08:30:00.000Z',
    isRead: false
  },

  // --- Khách hàng 3: Lê Thanh Thảo (cust_003) ---
  {
    id: 'msg_020',
    customerId: 'cust_003',
    customerName: 'Lê Thanh Thảo',
    customerPhone: '0912999888',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Shop ơi Bộ Chăm Sóc Tóc Thảo Dược có giúp giảm rụng tóc và kích thích mọc tóc nhanh không?',
    timestamp: '2026-07-18T10:45:00.000Z',
    isRead: true,
    readBy: 'Lê Hoàng Nam',
    readAt: '2026-07-18T10:48:00.000Z'
  },
  {
    id: 'msg_021',
    customerId: 'cust_003',
    customerName: 'Lê Thanh Thảo',
    customerPhone: '0912999888',
    sender: 'agent',
    agentName: 'Lê Hoàng Nam',
    channel: 'WhatsApp',
    content: 'Chào chị Thảo! Bộ thảo dược chứa tinh chất bưởi rừng và hà thủ ô, thông thường sau 2-3 tuần gội xả đều đặn sẽ thấy giảm rụng rõ rệt và chân tóc mới mọc khỏe hơn nhiều ạ.',
    timestamp: '2026-07-18T10:50:00.000Z',
    isRead: true
  },
  {
    id: 'msg_022',
    customerId: 'cust_003',
    customerName: 'Lê Thanh Thảo',
    customerPhone: '0912999888',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Cho mình đặt 1 bộ về Georgetown Penang nhé, nhớ giao trong giờ hành chính giúp mình.',
    timestamp: '2026-07-18T11:15:00.000Z',
    isRead: true,
    readBy: 'Lê Hoàng Nam',
    readAt: '2026-07-18T11:18:00.000Z'
  },
  {
    id: 'msg_023',
    customerId: 'cust_003',
    customerName: 'Lê Thanh Thảo',
    customerPhone: '0912999888',
    sender: 'agent',
    agentName: 'Lê Hoàng Nam',
    channel: 'WhatsApp',
    content: 'Dạ em đã lưu ghi chú giao giờ hành chính tại Penang và xuất đơn DH-20260718-02 (1.100.000đ) cho chị rồi ạ!',
    timestamp: '2026-07-18T11:20:00.000Z',
    isRead: true
  },

  // --- Khách hàng 4: David Nguyen (cust_004) ---
  {
    id: 'msg_030',
    customerId: 'cust_004',
    customerName: 'David Nguyen',
    customerPhone: '+1 415 555 2671',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Hello shop, mình muốn mua 2 Máy Rửa Mặt Ultrasonic Pro làm quà tặng bạn bè ở Mont Kiara, bên bạn có hỗ trợ gói quà không?',
    timestamp: '2026-07-10T19:30:00.000Z',
    isRead: true,
    readBy: 'Phạm Minh Đức',
    readAt: '2026-07-10T19:35:00.000Z'
  },
  {
    id: 'msg_031',
    customerId: 'cust_004',
    customerName: 'David Nguyen',
    customerPhone: '+1 415 555 2671',
    sender: 'agent',
    agentName: 'Phạm Minh Đức',
    channel: 'WhatsApp',
    content: 'Dạ chào anh David! Bên em có hỗ trợ hộp quà thắt nơ cao cấp và viết thiệp chúc mừng hoàn toàn miễn phí ạ. Máy chính hãng bảo hành 12 tháng 1 đổi 1.',
    timestamp: '2026-07-10T19:40:00.000Z',
    isRead: true
  },
  {
    id: 'msg_032',
    customerId: 'cust_004',
    customerName: 'David Nguyen',
    customerPhone: '+1 415 555 2671',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Tuyệt vời, mình vừa chuyển khoản 7.000.000đ rồi nhé. Giao sớm giúp mình.',
    timestamp: '2026-07-10T20:00:00.000Z',
    isRead: true,
    readBy: 'Phạm Minh Đức',
    readAt: '2026-07-10T20:01:00.000Z'
  },
  {
    id: 'msg_033',
    customerId: 'cust_004',
    customerName: 'David Nguyen',
    customerPhone: '+1 415 555 2671',
    sender: 'agent',
    agentName: 'Phạm Minh Đức',
    channel: 'WhatsApp',
    content: 'Dạ em đã nhận được thanh toán 7.000.000đ của anh David, em đóng gói quà gửi đi Mont Kiara ngay sáng mai ạ!',
    timestamp: '2026-07-10T20:05:00.000Z',
    isRead: true
  },

  // --- Khách hàng 5: Phạm Bích Phương (cust_005) ---
  {
    id: 'msg_040',
    customerId: 'cust_005',
    customerName: 'Phạm Bích Phương',
    customerPhone: '0977112233',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Chào shop, mình vừa để lại form trên website. Cho mình hỏi Kem Chống Nắng SPF50+ kiềm dầu tốt không và có bị bí da không ạ?',
    timestamp: '2026-07-23T08:35:00.000Z',
    isRead: false
  },

  // --- Khách hàng 6: Hoàng Anh Tuấn (cust_006) ---
  {
    id: 'msg_050',
    customerId: 'cust_006',
    customerName: 'Hoàng Anh Tuấn',
    customerPhone: '0933445566',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Shop tư vấn giúp mình chai Sữa Rửa Mặt Balance cho nam da dầu nhờn với.',
    timestamp: '2026-07-08T15:20:00.000Z',
    isRead: true,
    readBy: 'Nguyễn Văn Ánh',
    readAt: '2026-07-08T15:25:00.000Z'
  },
  {
    id: 'msg_051',
    customerId: 'cust_006',
    customerName: 'Hoàng Anh Tuấn',
    customerPhone: '0933445566',
    sender: 'agent',
    agentName: 'Nguyễn Văn Ánh',
    channel: 'WhatsApp',
    content: 'Chào anh Tuấn! Chai Balance làm sạch sâu bã nhờn nhưng giữ ẩm tự nhiên không gây căng rát. Giá ưu đãi đợt này là 450.000đ/chai 150ml anh nhé.',
    timestamp: '2026-07-08T15:35:00.000Z',
    isRead: true
  },
  {
    id: 'msg_052',
    customerId: 'cust_006',
    customerName: 'Hoàng Anh Tuấn',
    customerPhone: '0933445566',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Để mình xem lại rồi nhắn bạn sau nhé.',
    timestamp: '2026-07-08T15:40:00.000Z',
    isRead: true,
    readBy: 'Nguyễn Văn Ánh',
    readAt: '2026-07-08T15:45:00.000Z'
  },

  // --- Khách hàng 7: Sato Kenji (cust_007) ---
  {
    id: 'msg_060',
    customerId: 'cust_007',
    customerName: 'Sato Kenji',
    customerPhone: '+60 12 345 6789',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Hello, do you support fast delivery to Kota Kinabalu, Sabah? I want to order 1 Collagen Cream and 1 Ultrasonic Cleanser.',
    timestamp: '2026-07-05T17:30:00.000Z',
    isRead: true,
    readBy: 'Trần Thu Hà',
    readAt: '2026-07-05T17:35:00.000Z'
  },
  {
    id: 'msg_061',
    customerId: 'cust_007',
    customerName: 'Sato Kenji',
    customerPhone: '+60 12 345 6789',
    sender: 'agent',
    agentName: 'Trần Thu Hà',
    channel: 'WhatsApp',
    content: 'Hello Mr. Kenji! Yes, we provide express shipping to Sabah. The total for Collagen Cream (1,800,000đ) and Ultrasonic Cleanser (3,500,000đ) with VIP discount is 4,200,000 VND.',
    timestamp: '2026-07-05T17:45:00.000Z',
    isRead: true
  },
  {
    id: 'msg_062',
    customerId: 'cust_007',
    customerName: 'Sato Kenji',
    customerPhone: '+60 12 345 6789',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Confirmed, please ship to my Sabah address tomorrow. Thank you!',
    timestamp: '2026-07-05T17:55:00.000Z',
    isRead: true,
    readBy: 'Trần Thu Hà',
    readAt: '2026-07-05T17:58:00.000Z'
  },

  // --- Khách hàng 8: Đặng Ngọc Kim Anh (cust_008) ---
  {
    id: 'msg_070',
    customerId: 'cust_008',
    customerName: 'Đặng Ngọc Kim Anh',
    customerPhone: '0966554433',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Nam ơi, gửi cho chị thêm 2 hũ Kem Dưỡng Collagen với 1 Son Dưỡng như lần trước nhé, giao về Melaka City cho chị!',
    timestamp: '2026-07-15T09:30:00.000Z',
    isRead: true,
    readBy: 'Lê Hoàng Nam',
    readAt: '2026-07-15T09:32:00.000Z'
  },
  {
    id: 'msg_071',
    customerId: 'cust_008',
    customerName: 'Đặng Ngọc Kim Anh',
    customerPhone: '0966554433',
    sender: 'agent',
    agentName: 'Lê Hoàng Nam',
    channel: 'WhatsApp',
    content: 'Dạ vâng chị Kim Anh! Em lên đơn DH-20260715-11 ngay cho chị (3.500.000đ), em áp mã VIP giảm giá và tặng thêm quà cho chị nhé ạ!',
    timestamp: '2026-07-15T09:35:00.000Z',
    isRead: true
  },
  {
    id: 'msg_072',
    customerId: 'cust_008',
    customerName: 'Đặng Ngọc Kim Anh',
    customerPhone: '0966554433',
    sender: 'customer',
    channel: 'WhatsApp',
    content: 'Ok em, cảm ơn Nam nhiều nhé ❤️',
    timestamp: '2026-07-15T09:40:00.000Z',
    isRead: true,
    readBy: 'Lê Hoàng Nam',
    readAt: '2026-07-15T09:41:00.000Z'
  }
];

