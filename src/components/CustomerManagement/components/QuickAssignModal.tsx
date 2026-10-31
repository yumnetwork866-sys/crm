import React, { useMemo, useState } from 'react';
import { Shuffle, Users, X, Zap } from 'lucide-react';
import type { Customer } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

export type QuickAssignStrategy = 'round_robin' | 'load_balance' | 'random';

interface QuickAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerIds: string[];
  customers: Customer[];
  onApply: (input: {
    customerIds: string[];
    ownerNames: string[];
    strategy: QuickAssignStrategy;
  }) => Promise<boolean>;
}

const STRATEGY_LABELS: Array<{ id: QuickAssignStrategy; label: string; hint: string }> = [
  { id: 'round_robin', label: 'Chia tuần tự', hint: 'Khách 1 → Sale A, khách 2 → Sale B, khách 3 → Sale C…' },
  { id: 'load_balance', label: 'Cân bằng theo tải', hint: 'Ưu tiên sale đang phụ trách ít khách nhất' },
  { id: 'random', label: 'Chia ngẫu nhiên', hint: 'Trộn ngẫu nhiên rồi chia đều' },
];

export const QuickAssignModal: React.FC<QuickAssignModalProps> = ({
  isOpen,
  onClose,
  customerIds,
  customers,
  onApply,
}) => {
  const { users } = useAuth();
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<QuickAssignStrategy>('round_robin');
  const [isApplying, setIsApplying] = useState(false);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === 'active' && user.name.trim()),
    [users],
  );

  const currentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    customers.forEach((customer) => {
      if (!customer.owner) return;
      counts.set(customer.owner, (counts.get(customer.owner) || 0) + 1);
    });
    return counts;
  }, [customers]);

  const preview = useMemo(() => {
    if (selectedSales.length === 0 || customerIds.length === 0) return [];
    const counts = new Map<string, number>();
    if (strategy === 'load_balance') {
      selectedSales.forEach((name) => counts.set(name, currentCounts.get(name) || 0));
      const explicitCounts = new Map(selectedSales.map((name) => [name, counts.get(name) || 0]));
      customerIds.forEach(() => {
        const chosen = selectedSales.reduce((best, current) =>
          (explicitCounts.get(current)|| 0) <= (explicitCounts.get(best) || 0) ? current : best
        );
        explicitCounts.set(chosen, (explicitCounts.get(chosen) || 0) + 1);
      });
      return selectedSales.map((name) => ({
        name,
        current: currentCounts.get(name) || 0,
        assigned: (explicitCounts.get(name) || 0) - (currentCounts.get(name) || 0),
      }));
    }
    const ordered = strategy === 'random' ? [...customerIds].sort(() => Math.random() - 0.5) : customerIds;
    selectedSales.forEach((name) => counts.set(name, 0));
    ordered.forEach((_, index) => {
      const name = selectedSales[index % selectedSales.length];
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return selectedSales.map((name) => ({
      name,
      current: currentCounts.get(name) || 0,
      assigned: counts.get(name) || 0,
    }));
  }, [selectedSales, customerIds, strategy, currentCounts]);

  if (!isOpen) return null;

  const toggleSale = (name: string) => {
    setSelectedSales((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  const handleApply = async () => {
    if (selectedSales.length === 0 || customerIds.length === 0 || isApplying) return;
    setIsApplying(true);
    try {
      const succeeded = await onApply({
        customerIds,
        ownerNames: selectedSales,
        strategy,
      });
      if (succeeded) {
        setSelectedSales([]);
        setStrategy('round_robin');
        onClose();
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-2 text-amber-600">
            <Zap className="w-5 h-5" />
            <h3 className="font-bold text-lg text-slate-950">Chia Số Nhanh Cho Sales</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
            Số khách hàng cần chia: <strong className="text-slate-950">{customerIds.length}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Chọn Sales nhận khách ({selectedSales.length}/{activeUsers.length})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2">
              {activeUsers.length === 0 ? (
                <p className="text-xs text-slate-500 col-span-2 text-center py-4">Không có tài khoản sales nào đang hoạt động.</p>
              ) : (
                activeUsers.map((user) => (
                  <label
                    key={user.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition border ${
                      selectedSales.includes(user.name)
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSales.includes(user.name)}
                      onChange={() => toggleSale(user.name)}
                      className="w-3.5 h-3.5 accent-indigo-600"
                    />
                    <Users className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span className="truncate font-medium">{user.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Kiểu chia</label>
            <div className="space-y-1.5">
              {STRATEGY_LABELS.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition border ${
                    strategy === option.id
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="quick-assign-strategy"
                    value={option.id}
                    checked={strategy === option.id}
                    onChange={() => setStrategy(option.id)}
                    className="mt-0.5 w-3.5 h-3.5 accent-amber-600"
                  />
                  <span>
                    <span className={`block font-bold ${strategy === option.id ? 'text-amber-700' : 'text-slate-900'}`}>
                      {option.label}
                    </span>
                    <span className="text-[11px] text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {preview.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden" id="quick-assign-preview">
              <div className="bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Xem trước phân bổ
              </div>
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {preview.map((row) => (
                    <tr key={row.name}>
                      <td className="py-2 px-3 font-medium text-slate-900 truncate">{row.name}</td>
                      <td className="py-2 px-3 text-right font-semibold">
                        <span className="text-slate-500">đang có {row.current}</span>
                        {row.assigned > 0 && (
                          <span className="text-emerald-600"> → nhận thêm {row.assigned}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <button
            onClick={handleApply}
            disabled={selectedSales.length === 0 || customerIds.length === 0 || isApplying}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/25 flex items-center space-x-2 transition cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            <span>{isApplying ? 'Đang chia…' : `Chia ${customerIds.length} khách cho ${selectedSales.length} sales`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
