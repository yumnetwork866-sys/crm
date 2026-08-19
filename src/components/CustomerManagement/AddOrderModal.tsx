import React, { useState } from 'react';
import { X, ShoppingBag, Plus, Trash2, CheckCircle2, Sparkles } from 'lucide-react';
import type { Customer, CustomerOrder } from '../../types';
import { INITIAL_PRODUCTS } from '../../data/mockData';
import { formatVND } from '../../utils/crmUtils';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onAddOrder: (customerId: string, newOrder: CustomerOrder) => void;
}

const DEFAULT_PRICES: Record<string, number> = {
  'Kem Dưỡng Da Collagen Premium': 1800000,
  'Serum Vitamin C Sáng Da': 1000000,
  'Bộ Chăm Sóc Tóc Thảo Dược': 1100000,
  'Sữa Rút Mặt Nhẹ Dịu Balance': 450000,
  'Máy Rửa Mặt Ultrasonic Pro': 3500000,
  'Son Dưỡng Ẩm Hồng Tự Nhiên': 350000,
  'Kem Chống Nắng SPF50+ PA++++': 650000,
};

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  customer,
  onAddOrder,
}) => {
  const [items, setItems] = useState<
    { productName: string; quantity: number; price: number }[]
  >([
    {
      productName: INITIAL_PRODUCTS[0],
      quantity: 1,
      price: DEFAULT_PRICES[INITIAL_PRODUCTS[0]] || 1000000,
    },
  ]);

  if (!isOpen || !customer) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productName: INITIAL_PRODUCTS[0],
        quantity: 1,
        price: DEFAULT_PRICES[INITIAL_PRODUCTS[0]] || 1000000,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    } else {
      const defaultProd = INITIAL_PRODUCTS[0];
      setItems([{ productName: defaultProd, quantity: 1, price: DEFAULT_PRICES[defaultProd] || 500000 }]);
    }
  };

  const handleProductChange = (index: number, productName: string) => {
    const defaultPrice = DEFAULT_PRICES[productName] || 500000;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, productName, price: defaultPrice } : item
      )
    );
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, quantity) } : item))
    );
  };

  const handlePriceChange = (index: number, price: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, price: Math.max(0, price) } : item))
    );
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const orderCode = `DH-${todayStr.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const newOrder: CustomerOrder = {
      id: `ord_${Date.now()}`,
      orderCode,
      date: todayStr,
      totalAmount,
      status: 'Completed',
      products: items,
    };

    onAddOrder(customer.id, newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Thêm Đơn Hàng Mới</h2>
              <p className="text-xs text-slate-400">
                Khách hàng: <span className="text-emerald-400 font-semibold">{customer.name}</span> ({customer.phone})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-900 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-slate-700 transition cursor-pointer border border-slate-300 dark:border-slate-700 shadow-xs"
            title="Đóng"
          >
            <X className="w-5 h-5 text-slate-900 dark:text-slate-100" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Danh Sách Sản Phẩm Mua
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm dòng sản phẩm</span>
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex items-center space-x-2">
                  <select
                    value={item.productName}
                    onChange={(e) => handleProductChange(idx, e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {INITIAL_PRODUCTS.map((prod) => (
                      <option key={prod} value={prod}>{prod}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 text-slate-900 dark:text-rose-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition shrink-0 cursor-pointer"
                    title="Xóa dòng sản phẩm"
                  >
                    <Trash2 className="w-4 h-4 text-slate-900 dark:text-rose-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Số lượng</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Đơn giá (VND)</label>
                    <input
                      type="number"
                      step={50000}
                      value={item.price}
                      onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total display */}
          <div className="bg-white dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50 rounded-xl p-4 flex items-center justify-between shadow-xs">
            <div className="text-xs text-slate-800 dark:text-slate-300 font-bold">
              Tổng Giá Trị Đơn Hàng
            </div>
            <div className="text-lg font-bold text-[#00793d] dark:text-emerald-400">
              {formatVND(totalAmount)}
            </div>
          </div>

          {/* Automation Notice */}
          <div className="flex items-start space-x-2 bg-indigo-950/40 border border-indigo-800/50 p-3 rounded-xl text-xs text-indigo-300">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Kích hoạt Chăm Sóc Tự Động (Automation):</span>
              <p className="mt-0.5 text-slate-300">
                Sau khi bấm Tạo đơn, CRM sẽ chuyển trạng thái khách sang <strong className="text-indigo-300">Won</strong> và tự động lên lịch gửi tin WhatsApp theo quy trình Ngày +3, +5, +7, +15!
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Xác Nhận Tạo Đơn Hàng</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
