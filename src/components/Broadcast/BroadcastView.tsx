import React, { useState, useMemo } from 'react';
import {
  Send, ShieldCheck, ShieldAlert, Sparkles, CheckCircle2, MessageSquare,
  Users, Tag, Globe, Play, Layers, Clock, AlertTriangle
} from 'lucide-react';
import { Customer, BroadcastCampaign } from '../../types';
import { INITIAL_PRODUCTS } from '../../data/mockData';
import { getCustomerGroup } from '../../utils/crmUtils';

interface BroadcastViewProps {
  customers: Customer[];
  campaigns: BroadcastCampaign[];
  onLaunchCampaign: (newCampaign: BroadcastCampaign) => void;
  defaultTargetGroup?: string;
}

const CATEGORIES = ['Khuyến mại', 'Flash Sale', 'Voucher', 'Sản phẩm mới', 'Thông báo'] as const;

export const BroadcastView: React.FC<BroadcastViewProps> = ({
  customers,
  campaigns,
  onLaunchCampaign,
  defaultTargetGroup = 'Tất cả khách hàng',
}) => {
  const [campaignName, setCampaignName] = useState('Chiến Dịch Khuyến Mại WhatsApp');
  const [targetGroup, setTargetGroup] = useState<string>(defaultTargetGroup);
  const [targetProduct, setTargetProduct] = useState<string>('ALL');
  const [targetGender, setTargetGender] = useState<string>('ALL');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Flash Sale');

  const [templateText, setTemplateText] = useState(
    'Chào {{Customer Name}}, VietCRM gửi tặng bạn mã giảm giá đặc biệt VOUCHER30OFF giảm 30% cho bộ sản phẩm {{Product}}. Áp dụng ngay hôm nay nhé!'
  );

  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);

  // Calculate targeted audience strictly conforming to WhatsApp Opt-in
  const { targetedTotal, optedInTotal, eligibleCustomers } = useMemo(() => {
    const matched = customers.filter((c) => {
      // Group filter
      if (targetGroup === 'Khách mới') {
        if (getCustomerGroup(c) !== 'group_1') return false;
      } else if (targetGroup === 'Đã hỏi giá') {
        if (getCustomerGroup(c) !== 'group_2') return false;
      } else if (targetGroup === 'Đã mua 1 lần') {
        if (getCustomerGroup(c) !== 'group_3') return false;
      } else if (targetGroup === 'VIP' || targetGroup === 'VIP (Mua ≥ 2 lần)') {
        if (getCustomerGroup(c) !== 'group_4') return false;
      }

      // Product filter
      if (targetProduct !== 'ALL') {
        if (!c.interestedProducts || !c.interestedProducts.includes(targetProduct)) return false;
      }

      // Gender filter
      if (targetGender !== 'ALL') {
        if (!c.gender) return false;
        const cg = c.gender.trim().toLowerCase();
        const tg = targetGender.trim().toLowerCase();
        if (tg === 'nam' && !(cg === 'nam' || cg === 'male' || cg === 'm')) return false;
        if ((tg === 'nữ' || tg === 'nu') && !(cg === 'nữ' || cg === 'nu' || cg === 'female' || cg === 'f')) return false;
        if ((tg === 'khác' || tg === 'khac') && (cg === 'nam' || cg === 'nữ' || cg === 'nu')) return false;
      }

      return true;
    });

    const optedIn = matched.filter((c) => c.whatsappOptIn);

    return {
      targetedTotal: matched.length,
      optedInTotal: optedIn.length,
      eligibleCustomers: optedIn,
    };
  }, [customers, targetGroup, targetProduct, targetGender]);

  const handleInsertTag = (tag: string) => {
    setTemplateText((prev) => `${prev} ${tag}`);
  };

  const handleLaunch = () => {
    if (!campaignName.trim()) {
      alert('Vui lòng nhập tên chiến dịch!');
      return;
    }
    if (optedInTotal === 0) {
      alert('Không có khách hàng hợp lệ (đã Opt-In WhatsApp) trong tập lựa chọn này!');
      return;
    }

    setIsSending(true);
    setSendingProgress(10);

    const interval = setInterval(() => {
      setSendingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSending(false);

          const newCampaign: BroadcastCampaign = {
            id: `bc_${Date.now()}`,
            name: campaignName,
            targetGroup,
            targetProduct: targetProduct !== 'ALL' ? targetProduct : undefined,
            targetCountry: targetGender !== 'ALL' ? `Giới tính: ${targetGender}` : undefined,
            category,
            messageTemplate: templateText,
            createdAt: new Date().toLocaleString('vi-VN'),
            status: 'Completed',
            stats: {
              totalTargeted: targetedTotal,
              optedInCount: optedInTotal,
              sentCount: optedInTotal,
              deliveredCount: Math.round(optedInTotal * 0.96),
              readCount: Math.round(optedInTotal * 0.82),
              respondedCount: Math.round(optedInTotal * 0.35),
            },
          };

          onLaunchCampaign(newCampaign);
          alert(`Đã hoàn tất gửi Broadcast WhatsApp cho ${optedInTotal} khách hàng!`);
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  // Preview formatting
  const previewSampleCustomer = eligibleCustomers[0] || customers[0];
  const sampleMessagePreview = templateText
    .replace(/\{\{Customer Name\}\}/g, previewSampleCustomer?.name || 'Nguyễn Văn Minh')
    .replace(/\{\{Phone\}\}/g, previewSampleCustomer?.phone || '0901234567')
    .replace(/\{\{Product\}\}/g, previewSampleCustomer?.interestedProducts?.[0] || 'Kem Dưỡng Da Premium')
    .replace(/\{\{Voucher Code\}\}/g, 'VOUCHER30OFF');

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400 font-bold text-xs uppercase tracking-wider">
            <Send className="w-4 h-4" />
            <span>WhatsApp Business Platform Broadcast</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">Gửi Tin Nhắn Hàng Loạt (Broadcast)</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Tạo chiến dịch gửi thông báo, voucher, flash sale đến từng nhóm khách hàng mục tiêu theo đúng chính sách chấp thuận (Opt-In) của WhatsApp.
          </p>
        </div>
      </div>

      {/* WhatsApp Compliance Warning */}
      <div className="bg-amber-500/15 border border-amber-500/40 p-4 rounded-2xl flex items-start space-x-3 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-900 dark:text-amber-300 text-sm">Chính Sách WhatsApp Business Platform (Opt-In Compliance)</span>
          <p className="mt-0.5 text-amber-800 dark:text-amber-200/90 leading-relaxed">
            Hệ thống CRM tự động lọc và <strong>chỉ gửi tin nhắn cho khách hàng đã đồng ý nhận tin nhắn (Opt-In)</strong>. Khách chưa Opt-In sẽ tự động bị bỏ qua để bảo vệ uy tín thương hiệu và tuân thủ chính sách chống Spam.
          </p>
        </div>
      </div>

      {/* Main Campaign Builder Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Audience & Content Setup */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          
          <h3 className="font-bold text-white text-sm flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Users className="w-4 h-4 text-teal-400" />
            <span>1. Lựa Chọn Nhóm Khách Hàng Mục Tiêu</span>
          </h3>

          <div className="space-y-4 text-xs">
            
            {/* Campaign Name */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Tên Chiến Dịch Broadcast</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ví dụ: Tri Ân Khách Hàng Thân Thiết"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Target Group Selector */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Nhóm Khách Hàng CRM</label>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500 font-semibold text-teal-300"
              >
                <option value="Tất cả khách hàng">Tất cả khách hàng trong CRM</option>
                <option value="Khách mới">Nhóm 1: Khách mới (Chưa tư vấn)</option>
                <option value="Đã hỏi giá">Nhóm 2: Đã hỏi giá (Chưa mua)</option>
                <option value="Đã mua 1 lần">Nhóm 3: Đã mua 1 lần</option>
                <option value="VIP">Nhóm 4: VIP (Đã mua ≥2 lần)</option>
              </select>
            </div>

            {/* Sub-Filters: Product & Country */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Theo Sản Phẩm Quan Tâm</label>
                <select
                  value={targetProduct}
                  onChange={(e) => setTargetProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="ALL">Tất cả sản phẩm</option>
                  {INITIAL_PRODUCTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Theo Giới Tính</label>
                <select
                  value={targetGender}
                  onChange={(e) => setTargetGender(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="ALL">Tất cả giới tính</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            {/* Audience Count Summary Display */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="text-slate-400">Khách thỏa mãn bộ lọc:</div>
                <div className="text-sm font-bold text-white">{targetedTotal} khách</div>
              </div>

              <div className="text-right">
                <div className="text-[#00793d] dark:text-[#20a361] font-semibold flex items-center space-x-1 justify-end">
                  <ShieldCheck className="w-4 h-4 text-[#00793d] dark:text-[#20a361]" />
                  <span>Đủ điều kiện gửi (Opt-In):</span>
                </div>
                <div className="text-xl font-extrabold text-[#00793d] dark:text-[#20a361]">{optedInTotal} khách</div>
              </div>
            </div>

          </div>

          <hr className="border-slate-800" />

          {/* Category & Message Template */}
          <h3 className="font-bold text-white text-sm flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            <span>2. Loại Tin Nhắn & Nội Dung Template</span>
          </h3>

          <div className="space-y-4 text-xs">
            
            {/* Category selection */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Loại Tin Nhắn</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl font-medium border transition ${
                      category === cat
                        ? 'bg-teal-600 border-teal-500 text-white shadow'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Tags */}
            <div>
              <span className="block text-slate-400 mb-1">Chèn thẻ biến số tự động:</span>
              <div className="flex flex-wrap gap-1.5">
                {['{{Customer Name}}', '{{Phone}}', '{{Product}}', '{{Voucher Code}}'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInsertTag(tag)}
                    className="px-2 py-1 bg-indigo-950 border border-indigo-700 text-indigo-300 rounded-lg text-[11px] font-mono hover:bg-indigo-900 transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Soạn Nội Dung Tin Nhắn</label>
              <textarea
                value={templateText}
                onChange={(e) => setTemplateText(e.target.value)}
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs leading-relaxed focus:outline-none focus:border-teal-500 font-sans"
              />
            </div>

          </div>

          {/* Launch Trigger */}
          <div className="pt-2">
            <button
              onClick={handleLaunch}
              disabled={isSending || optedInTotal === 0}
              className="w-full py-3 bg-[#00793d] hover:bg-[#006232] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-[#00793d]/25 transition flex items-center justify-center space-x-2 text-sm"
            >
              <Send className="w-4 h-4" />
              <span>Gửi Broadcast Cho {optedInTotal} Khách Hàng</span>
            </button>

            {isSending && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-[#00793d] dark:text-teal-400 font-bold">
                  <span>Đang gửi qua WhatsApp API...</span>
                  <span>{sendingProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#00793d] h-full transition-all duration-300"
                    style={{ width: `${sendingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Live WhatsApp Preview & Campaign History */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* WhatsApp Phone Mockup Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Xem Trước Màn Hình WhatsApp Của Khách</span>
            </h4>

            {/* Phone Screen Container */}
            <div className="bg-[#0b141a] rounded-2xl p-4 border border-slate-800 shadow-2xl text-xs space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-[11px] text-teal-400 font-semibold">
                <div className="w-6 h-6 rounded-full bg-[#00793d] flex items-center justify-center text-white text-[10px] font-bold">
                  WA
                </div>
                <span>VietCRM Official Business Account</span>
              </div>

              <div className="bg-[#111b21] p-3.5 rounded-xl text-slate-100 border border-slate-800 space-y-2">
                <div className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider">
                  [{category}]
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-white">
                  {sampleMessagePreview}
                </p>
                <div className="text-[10px] text-slate-200 text-right">09:30 AM ✓✓</div>
              </div>

              <div className="text-[10px] text-slate-200 text-center italic">
                Xem trước cá nhân hóa cho: <strong className="text-white font-bold">{previewSampleCustomer?.name}</strong>
              </div>
            </div>
          </div>

          {/* Broadcast Campaign History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Lịch Sử Các Chiến Dịch Broadcast Đã Gửi
            </h4>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
               {campaigns.map((camp) => {
                const totalTargeted = camp.stats?.totalTargeted ?? (camp as any).totalTargeted ?? 0;
                const optedInCount = camp.stats?.optedInCount ?? (camp as any).optedInCount ?? 0;
                const sentCount = camp.stats?.sentCount ?? (camp as any).sentCount ?? 0;
                const deliveredCount = camp.stats?.deliveredCount ?? (camp as any).deliveredCount ?? 0;
                const readCount = camp.stats?.readCount ?? (camp as any).readCount ?? 0;
                const respondedCount = camp.stats?.respondedCount ?? (camp as any).respondedCount ?? 0;

                return (
                  <div key={camp.id} className="bg-slate-800/80 border border-slate-700/70 p-3.5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white text-sm">{camp.name}</span>
                      <span className="text-[10px] bg-[#00793d]/20 text-[#00793d] dark:text-emerald-300 border border-[#00793d]/40 px-2.5 py-0.5 rounded-full font-bold">
                        {camp.status}
                      </span>
                    </div>

                    <div className="text-slate-400 text-[11px] flex items-center space-x-2">
                      <span>Target: <strong className="text-teal-300">{camp.targetGroup}</strong></span>
                      <span>•</span>
                      <span>{camp.createdAt}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[10px] text-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400">Đã gửi</span>
                        <div className="font-bold text-white">{sentCount}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Đã nhận</span>
                        <div className="font-bold text-[#00793d] dark:text-teal-300">{deliveredCount}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Tỷ lệ đọc</span>
                        <div className="font-bold text-[#00793d] dark:text-emerald-400">
                          {sentCount > 0 ? Math.round((readCount / sentCount) * 100) : 0}%
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Phản hồi</span>
                        <div className="font-bold text-amber-300">{respondedCount}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
