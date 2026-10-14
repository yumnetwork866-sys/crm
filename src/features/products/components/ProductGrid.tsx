import React from 'react';
import { Package, Boxes, AlertTriangle, TrendingUp, CheckCheck } from 'lucide-react';
import { formatVND } from '../../../utils/crmUtils';

interface ProductGridProps {
  hideOverviewCards?: boolean;
  totalProductsCount: number;
  inStockCount: number;
  lowStockCount: number;
  totalStockValue: number;
  syncAlert: { type: 'success' | 'error'; message: string } | null;
  onCloseSyncAlert: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  hideOverviewCards = false,
  totalProductsCount,
  inStockCount,
  lowStockCount,
  totalStockValue,
  syncAlert,
  onCloseSyncAlert,
}) => {
  return (
    <>
      {/* Top Metrics Grid */}
      {!hideOverviewCards && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Tổng Mã Sản Phẩm</div>
              <div className="text-2xl font-bold text-white mt-1">{totalProductsCount} SKUs</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Danh mục hàng hóa</div>
            </div>
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Sẵn Hàng Trong Kho</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{inStockCount} sản phẩm</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Sẵn sàng xuất đơn</div>
            </div>
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Boxes className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Cảnh Báo Sắp Hết Kho</div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{lowStockCount} sản phẩm</div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">Cần bổ sung hàng gấp</div>
            </div>
            <div className="p-3 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-300 dark:border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Giá Trị Tồn Kho Nguồn</div>
              <div className="text-2xl font-bold text-[#00793d] dark:text-emerald-400 mt-1">{formatVND(totalStockValue)}</div>
              <div className="text-[11px] text-[#00793d] dark:text-emerald-400 font-semibold mt-0.5">Tổng trị giá hàng hóa</div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/20 text-[#00793d] dark:text-emerald-400 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {syncAlert && (
        <div className={`p-4 rounded-2xl text-xs font-semibold border flex items-center justify-between gap-3 ${
          syncAlert.type === 'success'
            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
            : 'bg-rose-950/50 text-rose-300 border-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {syncAlert.type === 'success' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{syncAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={onCloseSyncAlert}
            className="text-xs hover:underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}
    </>
  );
};
