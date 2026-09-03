import React, { useState } from 'react';
import { Zap, Heart, MessageCircle, HelpCircle, Gift, Sparkles, Clock, CheckCircle2, Play, User, ArrowRight } from 'lucide-react';
import type { Customer } from '../../types';
import { formatDate } from '../../utils/crmUtils';

interface AutomationViewProps {
  customers: Customer[];
  onRunSimulation: () => void;
  onSelectCustomer: (customer: Customer) => void;
}

export const AUTOMATION_STEPS = [
  {
    step: 1,
    dayOffset: 3,
    title: 'Ngày +3: Lời Cảm Ơn & HDSD',
    objective: 'Bày tỏ lòng tri ân, gửi video/văn bản hướng dẫn sử dụng sản phẩm chuẩn xác.',
    icon: Heart,
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/40 text-pink-400',
    defaultMsg: 'Chào {{Customer Name}}, VietCRM xin gửi lời cảm ơn chân thành bạn đã tin dùng sản phẩm. Nhấp vào liên kết sau để xem video hướng dẫn sử dụng chuẩn spa nhé!',
  },
  {
    step: 2,
    dayOffset: 5,
    title: 'Ngày +5: Hỏi Trải Nghiệm',
    objective: 'Thâm vấn sự hài lòng sau 5 ngày trải nghiệm, xử lý sớm phản hồi.',
    icon: MessageCircle,
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400',
    defaultMsg: 'Chào {{Customer Name}}, bạn đã dùng sản phẩm được 5 ngày rồi. Làn da/mái tóc của bạn có cảm thấy mượt mà và dịu nhẹ hơn chưa? Hãy chia sẻ với bọn mình nhé!',
  },
  {
    step: 3,
    dayOffset: 7,
    title: 'Ngày +7: Giải Đáp & Gợi Ý SP',
    objective: 'Giải đáp thắc mắc thói quen skincare/chăm sóc và tư vấn dòng sản phẩm bổ trợ.',
    icon: HelpCircle,
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-400',
    defaultMsg: 'Chào {{Customer Name}}, nếu có bất kỳ thắc mắc nào khi kết hợp sản phẩm, đừng ngần ngại hỏi nhé! Ngoài ra, kết hợp cùng Serum Vitamin C sẽ nhân đôi hiệu quả đấy ạ.',
  },
  {
    step: 4,
    dayOffset: 15,
    title: 'Ngày +15: Gửi Voucher & Mua Lại',
    objective: 'Tặng mã giảm giá riêng tri ân khách hàng cũ, khuyến khích đặt hàng lần tiếp theo.',
    icon: Gift,
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400',
    defaultMsg: 'Chào {{Customer Name}}, tặng bạn Voucher VIP20OFF giảm 20% cho đơn hàng tiếp theo. Mã có hiệu lực trong 7 ngày tới, đặt ngay nhé!',
  },
];

export const AutomationView: React.FC<AutomationViewProps> = ({
  customers,
  onRunSimulation,
  onSelectCustomer,
}) => {
  const [selectedStep, setSelectedStep] = useState<number>(1);

  // Filter customers that have orders and active automation sequences
  const automationCustomers = customers.filter(
    (c) => c.totalOrders >= 1 && c.automationSequence?.active
  );

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Zap className="w-4 h-4 text-amber-500 dark:text-amber-300" />
            <span>Kích Hoạt Tự Động 100% Sau Khi Mua</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Quy Trình Automation WhatsApp Sau Mua
          </h2>
        </div>

        <button
          onClick={onRunSimulation}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-2 shrink-0 transition"
        >
          <Play className="w-4 h-4 text-amber-300 fill-amber-300" />
          <span>Mô Phỏng Chạy Automation Ngay</span>
        </button>
      </div>

      {/* Interactive Workflow Sequence Builder Diagram */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <span>Khung Quy Trình 4 Bước Chăm Sóc Tuần Tự</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {AUTOMATION_STEPS.map((stepItem) => {
            const Icon = stepItem.icon;
            const isSelected = selectedStep === stepItem.step;

            return (
              <div
                key={stepItem.step}
                onClick={() => setSelectedStep(stepItem.step)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500 shadow-xl ring-2 ring-emerald-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stepItem.color} border`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                    Bước {stepItem.step}
                  </span>
                </div>

                <h4 className="font-bold text-white text-sm">{stepItem.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 min-h-[36px]">
                  {stepItem.objective}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                  <span>Tự động kích hoạt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Step Details & Template Preview */}
      {selectedStep && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Mẫu Tin Nhắn WhatsApp Chi Tiết — {AUTOMATION_STEPS[selectedStep - 1].title}</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-xl text-xs space-y-2">
            <p className="text-slate-300 leading-relaxed font-mono">
              "{AUTOMATION_STEPS[selectedStep - 1].defaultMsg}"
            </p>
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700/60 flex items-center justify-between">
              <span>Thẻ động biến số: <code className="text-indigo-300 font-bold">&#123;&#123;Customer Name&#125;&#125;</code></span>
              <span className="text-emerald-400">Gửi qua WhatsApp Business API</span>
            </div>
          </div>
        </div>
      )}

      {/* Customers Currently in Automation Pipeline Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base">
              Danh Sách Khách Hàng Đang Trong Quy Trình Automation ({automationCustomers.length})
            </h3>
            <p className="text-xs text-slate-400">
              Trạng thái hoàn thành từng bước Ngày +3, Ngày +5, Ngày +7, Ngày +15 của mỗi khách.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <th className="py-2.5 px-4">Khách Hàng</th>
                <th className="py-2.5 px-3">SĐT & Quốc Gia</th>
                <th className="py-2.5 px-3 text-center">Ngày +3 (HDSD)</th>
                <th className="py-2.5 px-3 text-center">Ngày +5 (Trải nghiệm)</th>
                <th className="py-2.5 px-3 text-center">Ngày +7 (Tư vấn)</th>
                <th className="py-2.5 px-3 text-center">Ngày +15 (Voucher)</th>
                <th className="py-2.5 px-4 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {automationCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    Chưa có khách hàng nào trong quy trình. Hãy tạo đơn hàng cho khách để kích hoạt!
                  </td>
                </tr>
              ) : (
                automationCustomers.map((c) => {
                  const seqStep = c.automationSequence?.currentStep || 0;

                  return (
                    <tr key={c.id} className="transition">
                      <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {c.phone} ({c.country})
                      </td>

                      {/* Step 1 */}
                      <td className="py-3 px-3 text-center">
                        {seqStep >= 1 ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
                            ✓ Đã Gửi
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Chờ</span>
                        )}
                      </td>

                      {/* Step 2 */}
                      <td className="py-3 px-3 text-center">
                        {seqStep >= 2 ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
                            ✓ Đã Gửi
                          </span>
                        ) : seqStep === 1 ? (
                          <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full text-[10px]">
                            ⏳ Kế tiếp
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Chờ</span>
                        )}
                      </td>

                      {/* Step 3 */}
                      <td className="py-3 px-3 text-center">
                        {seqStep >= 3 ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
                            ✓ Đã Gửi
                          </span>
                        ) : seqStep === 2 ? (
                          <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full text-[10px]">
                            ⏳ Kế tiếp
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Chờ</span>
                        )}
                      </td>

                      {/* Step 4 */}
                      <td className="py-3 px-3 text-center">
                        {seqStep >= 4 ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
                            ✓ Hoàn thành
                          </span>
                        ) : seqStep === 3 ? (
                          <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full text-[10px]">
                            ⏳ Kế tiếp
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Chờ</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectCustomer(c)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
