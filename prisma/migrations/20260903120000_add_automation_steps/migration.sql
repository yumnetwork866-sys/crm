CREATE TABLE IF NOT EXISTS "AutomationStep" (
  "id" TEXT NOT NULL,
  "step" INTEGER NOT NULL,
  "dayOffset" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "defaultMsg" TEXT NOT NULL,
  "iconName" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "templateName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationStep_step_key"
  ON "AutomationStep"("step");

CREATE INDEX IF NOT EXISTS "AutomationStep_active_dayOffset_idx"
  ON "AutomationStep"("active", "dayOffset");

INSERT INTO "AutomationStep" (
  "id",
  "step",
  "dayOffset",
  "title",
  "defaultMsg",
  "iconName",
  "color",
  "active",
  "updatedAt"
)
VALUES
  (
    'step_1',
    1,
    3,
    'Ngày +3: Lời Cảm Ơn & HDSD',
    'Chào {{Customer Name}}, VietCRM xin gửi lời cảm ơn chân thành bạn đã tin dùng sản phẩm. Nhấp vào liên kết sau để xem video hướng dẫn sử dụng chuẩn spa nhé!',
    'Heart',
    '#e11d48',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'step_2',
    2,
    5,
    'Ngày +5: Hỏi Trải Nghiệm',
    'Chào {{Customer Name}}, bạn đã dùng sản phẩm được 5 ngày rồi. Làn da/mái tóc của bạn có cảm thấy mượt mà và dịu nhẹ hơn chưa? Hãy chia sẻ với bọn mình nhé!',
    'MessageCircle',
    '#d97706',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'step_3',
    3,
    7,
    'Ngày +7: Giải Đáp & Gợi Ý SP',
    'Chào {{Customer Name}}, nếu có bất kỳ thắc mắc nào khi kết hợp sản phẩm, đừng ngần ngại hỏi nhé! Ngoài ra, kết hợp cùng Serum Vitamin C sẽ nhân đôi hiệu quả đấy ạ.',
    'HelpCircle',
    '#2563eb',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'step_4',
    4,
    15,
    'Ngày +15: Gửi Voucher & Mua Lại',
    'Chào {{Customer Name}}, tặng bạn Voucher VIP20OFF giảm 20% cho đơn hàng tiếp theo. Mã có hiệu lực trong 7 ngày tới, đặt ngay nhé!',
    'Gift',
    '#059669',
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("step") DO NOTHING;
