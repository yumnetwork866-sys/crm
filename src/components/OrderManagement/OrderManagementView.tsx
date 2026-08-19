import React, { useState } from 'react';
import type { Customer, CustomerOrder, Product } from '../../types';
import { formatVND } from '../../utils/crmUtils';
import { ImportOrderCsvModal } from '../CsvImport/ImportOrderCsvModal';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Trash2,
  Printer,
  X,
  Save,
  User,
  Package,
  DollarSign,
  Phone,
  Sparkles,
  Upload
} from 'lucide-react';

interface OrderManagementViewProps {
  customers: Customer[];
  products: Product[];
  onCreateOrder: (order: CustomerOrder) => void;
  onUpdateOrderStatus: (orderId: string, customerId: string, status: CustomerOrder['status']) => void;
  onDeleteOrder: (orderId: string, customerId: string) => void;
  onImportOrders?: (importedOrders: { customerPhone: string; order: CustomerOrder }[]) => void;
}

export const OrderManagementView: React.FC<OrderManagementViewProps> = ({
  customers,
  products,
  onCreateOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onImportOrders,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<CustomerOrder | null>(null);

  // New Order Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderStatus, setOrderStatus] = useState<CustomerOrder['status']>('Completed');
  const [orderItems, setOrderItems] = useState<
    { productId: string; productName: string; quantity: number; price: number }[]
  >([
    {
      productId: products[0]?.id || 'prd_001',
      productName: products[0]?.name || 'Kem Dưỡng Da Collagen Premium',
      quantity: 1,
      price: products[0]?.price || 1800000,
    },
  ]);
  const [orderNotes, setOrderNotes] = useState('');

  // Gather ALL orders from all customers
  const allOrdersWithCustomerInfo: (CustomerOrder & { customerName: string; customerPhone: string; customerId: string })[] = [];
  customers.forEach((cust) => {
    (cust.orders || []).forEach((ord) => {
      allOrdersWithCustomerInfo.push({
        ...ord,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
      });
    });
  });

  // Sort by date descending
  allOrdersWithCustomerInfo.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filtered orders
  const filteredOrders = allOrdersWithCustomerInfo.filter((ord) => {
    const matchesSearch =
      ord.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.customerPhone.includes(searchTerm) ||
      ord.products.some((p) => p.productName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Metrics
  const totalOrdersCount = allOrdersWithCustomerInfo.length;
  const completedOrders = allOrdersWithCustomerInfo.filter((o) => o.status === 'Completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const processingCount = allOrdersWithCustomerInfo.filter((o) => o.status === 'Processing').length;

  const handleAddItemRow = () => {
    const firstPrd = products[0];
    setOrderItems((prev) => [
      ...prev,
      {
        productId: firstPrd ? firstPrd.id : 'prd_001',
        productName: firstPrd ? firstPrd.name : 'Sản Phẩm Mới',
        quantity: 1,
        price: firstPrd ? firstPrd.price : 500000,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    } else {
      const firstPrd = products[0];
      setOrderItems([
        {
          productId: firstPrd ? firstPrd.id : 'prd_001',
          productName: firstPrd ? firstPrd.name : 'Sản Phẩm Mới',
          quantity: 1,
          price: firstPrd ? firstPrd.price : 500000,
        },
      ]);
    }
  };

  const handleProductChange = (index: number, prdId: string) => {
    const found = products.find((p) => p.id === prdId);
    if (!found) return;
    setOrderItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            productId: found.id,
            productName: found.name,
            price: found.price,
          };
        }
        return item;
      })
    );
  };

  const calculateTotalOrderAmount = () => {
    return orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleSaveNewOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Vui lòng chọn khách hàng.');
      return;
    }
    if (orderItems.length === 0) {
      alert('Vui lòng chọn ít nhất 1 sản phẩm.');
      return;
    }

    const selectedCust = customers.find((c) => c.id === selectedCustomerId);
    const orderCodeStr = `DH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`;

    const newOrderObj: CustomerOrder = {
      id: `ord_${Date.now()}`,
      orderCode: orderCodeStr,
      customerId: selectedCustomerId,
      customerName: selectedCust?.name,
      customerPhone: selectedCust?.phone,
      date: orderDate,
      totalAmount: calculateTotalOrderAmount(),
      status: orderStatus,
      products: orderItems,
      notes: orderNotes,
    };

    onCreateOrder(newOrderObj);
    setIsCreateModalOpen(false);
    alert(`Tạo đơn hàng ${orderCodeStr} thành công!`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Tổng Đơn Hàng</div>
            <div className="text-2xl font-bold text-white mt-1">{totalOrdersCount} đơn</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Toàn hệ thống CRM</div>
          </div>
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Đơn Hàng Hoàn Tất</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{completedOrders.length} đơn</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Thành công 100%</div>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Đang Xử Lý & Giao Hàng</div>
            <div className="text-2xl font-bold text-[#0081ff] dark:text-[#389bff] mt-1">{processingCount} đơn</div>
            <div className="text-[11px] text-[#0081ff] dark:text-[#389bff] font-semibold mt-0.5">Đang vận chuyển</div>
          </div>
          <div className="p-3 bg-[#0081ff]/10 dark:bg-[#0081ff]/20 text-[#0081ff] dark:text-[#389bff] rounded-xl border border-[#0081ff]/30">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Tổng Doanh Thu Thực Nhận</div>
            <div className="text-2xl font-bold text-[#00793d] dark:text-emerald-400 mt-1">{formatVND(totalRevenue)}</div>
            <div className="text-[11px] text-[#00793d] dark:text-emerald-400 font-semibold mt-0.5">Cộng dồn bán hàng</div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/20 text-[#00793d] dark:text-emerald-400 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Control Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã ĐH, tên KH, SĐT..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả đơn hàng</option>
              <option value="Completed">Hoàn Tất (Completed)</option>
              <option value="Processing">Đang Xử Lý (Processing)</option>
              <option value="Cancelled">Đã Hủy (Cancelled)</option>
            </select>
          </div>

          <button
            onClick={() => setIsImportCsvOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-700/80 hover:bg-indigo-600 text-white border border-indigo-500/40 shadow-md transition active:scale-95 cursor-pointer"
            title="Nhập danh sách đơn hàng hàng loạt bằng file CSV"
          >
            <Upload className="w-4 h-4" />
            <span>Nhập CSV</span>
          </button>

          <button
            onClick={() => {
              if (customers.length > 0) setSelectedCustomerId(customers[0].id);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Đơn Hàng Mới</span>
          </button>

        </div>

      </div>

      {/* Centralized Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="font-bold text-white text-sm">Quản Lý Tất Cả Đơn Hàng ({filteredOrders.length})</h3>

            {selectedOrderIds.length > 0 && (
              <span className="font-semibold text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Đã chọn: {selectedOrderIds.length} / {filteredOrders.length}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">Sắp xếp ngày mới nhất</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredOrders.length > 0 &&
                      selectedOrderIds.length === filteredOrders.length
                    }
                    onChange={() => {
                      if (selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0) {
                        setSelectedOrderIds([]);
                      } else {
                        setSelectedOrderIds(filteredOrders.map((o) => o.id));
                      }
                    }}
                    title="Chọn tất cả / Bỏ chọn tất cả"
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                  />
                </th>
                <th className="py-3 px-4">Mã Đơn / Ngày</th>
                <th className="py-3 px-3">Khách Hàng</th>
                <th className="py-3 px-3">Sản Phẩm Chi Tiết</th>
                <th className="py-3 px-3 text-right">Tổng Tiền (VND)</th>
                <th className="py-3 px-3 text-center">Trạng Thái Đơn</th>
                <th className="py-3 px-4 text-right">Hóa Đơn / Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Không tìm thấy đơn hàng nào.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isSelected = selectedOrderIds.includes(ord.id);
                  const isBatchActive = selectedOrderIds.length > 0;
                  return (
                    <tr
                      key={ord.id}
                      className={`transition ${isSelected ? 'bg-emerald-950/30' : 'hover:bg-slate-800/40'}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedOrderIds((prev) =>
                              prev.includes(ord.id) ? prev.filter((i) => i !== ord.id) : [...prev, ord.id]
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        />
                      </td>
                    
                    {/* Order Code & Date */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-purple-700 dark:text-purple-400 text-xs">{ord.orderCode}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{ord.date}</div>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{ord.customerName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{ord.customerPhone}</span>
                      </div>
                    </td>

                    {/* Products summary */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5 max-w-xs">
                        {ord.products.map((p, idx) => (
                          <div key={idx} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span className="truncate pr-2">• {p.productName}</span>
                            <span className="font-semibold text-slate-500 dark:text-slate-400">x{p.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-3 text-right font-bold text-[#00793d] dark:text-emerald-400">
                      {formatVND(ord.totalAmount)}
                    </td>

                    {/* Status dropdown selector */}
                    <td className="py-3 px-3 text-center">
                      <select
                        value={ord.status}
                        onChange={(e) =>
                          onUpdateOrderStatus(
                            ord.id,
                            ord.customerId,
                            e.target.value as CustomerOrder['status']
                          )
                        }
                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border focus:outline-none cursor-pointer ${
                          ord.status === 'Completed'
                            ? 'bg-emerald-50 text-[#00793d] border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                            : ord.status === 'Processing'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40'
                            : 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40'
                        }`}
                      >
                        <option value="Completed" className="bg-white text-[#00793d] dark:bg-slate-900 dark:text-emerald-400">
                          ✓ Hoàn Tất
                        </option>
                        <option value="Processing" className="bg-white text-amber-800 dark:bg-slate-900 dark:text-amber-400">
                          ⏳ Đang Xử Lý
                        </option>
                        <option value="Cancelled" className="bg-white text-rose-700 dark:bg-slate-900 dark:text-rose-400">
                          ✕ Đã Hủy
                        </option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setInvoiceOrder(ord)}
                          className="p-1.5 rounded-lg text-slate-900 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-200 dark:hover:bg-indigo-500/20 transition cursor-pointer font-bold"
                          title="Xem / In Hóa Đơn"
                        >
                          <FileText className="w-4 h-4 text-slate-900 dark:text-slate-300" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Xóa đơn hàng ${ord.orderCode}?`)) {
                              onDeleteOrder(ord.id, ord.customerId);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-900 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition cursor-pointer font-bold"
                          title="Xóa đơn hàng"
                        >
                          <Trash2 className="w-4 h-4 text-slate-900 dark:text-slate-300" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Create New Order */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
            
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-900 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-slate-700 rounded-full transition shadow-xs border border-slate-300 dark:border-slate-700 cursor-pointer"
              title="Thoát"
            >
              <X className="w-5 h-5 text-slate-900 dark:text-slate-100" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <span>Tạo Đơn Hàng Mới Cho Khách Hàng</span>
            </h2>

            <form onSubmit={handleSaveNewOrder} className="space-y-4">
              
              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chọn Khách Hàng Mua Hàng *
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="" disabled>
                    -- Chọn khách hàng --
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) - {c.owner}
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Date & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày Đặt Hàng</label>
                  <input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Trạng Thái Đơn</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as CustomerOrder['status'])}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Completed">Completed (Hoàn tất)</option>
                    <option value="Processing">Processing (Đang giao)</option>
                    <option value="Cancelled">Cancelled (Đã hủy)</option>
                  </select>
                </div>
              </div>

              {/* Product Items Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">Danh Sách Sản Phẩm Mua</label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                  >
                    + Thêm dòng sản phẩm
                  </button>
                </div>

                <div className="space-y-2">
                  {orderItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-slate-950 p-2 rounded-xl border border-slate-800"
                    >
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} - {formatVND(p.price)}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const q = parseInt(e.target.value) || 1;
                          setOrderItems((prev) =>
                            prev.map((it, i) => (i === index ? { ...it, quantity: q } : it))
                          );
                        }}
                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                      />

                      <div className="w-24 text-right font-bold text-emerald-400 text-xs">
                        {formatVND(item.price * item.quantity)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="p-1.5 text-slate-900 dark:text-rose-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition shrink-0 cursor-pointer"
                        title="Xóa dòng sản phẩm"
                      >
                        <Trash2 className="w-4 h-4 text-slate-900 dark:text-rose-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto Total Calculation Banner */}
              <div className="bg-white dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/40 p-3.5 rounded-xl flex items-center justify-between text-xs shadow-xs">
                <span className="text-slate-800 dark:text-slate-300 font-bold">Tổng Tiền Thanh Toán:</span>
                <span className="text-base font-bold text-[#00793d] dark:text-emerald-400">
                  {formatVND(calculateTotalOrderAmount())}
                </span>
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi Chú Đơn Hàng</label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Yêu cầu đóng gói, mã giảm giá, hình thức thanh toán..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Xác Nhận Tạo Đơn</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal 2: View / Print Invoice Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            
            <button
              onClick={() => setInvoiceOrder(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Invoice Printable View */}
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="font-extrabold text-lg text-indigo-400 tracking-wide">VIETCRM INVOICE</div>
                  <div className="text-[10px] text-slate-400">Hóa đơn bán hàng điện tử</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-white">{invoiceOrder.orderCode}</div>
                  <div className="text-xs text-slate-400">{invoiceOrder.date}</div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="text-xs space-y-1">
                <div className="text-slate-400 font-semibold">Khách Hàng Mua Hàng:</div>
                <div className="font-bold text-slate-900 text-sm">{invoiceOrder.customerName}</div>
                <div className="text-slate-400">Số Điện Thoại: {invoiceOrder.customerPhone}</div>
              </div>

              {/* Itemized List */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-1">Chi Tiết Hàng Hóa</div>
                {invoiceOrder.products.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                    <div>
                      <div>{p.productName}</div>
                      <div className="text-[10px] text-slate-500">{formatVND(p.price)} x {p.quantity}</div>
                    </div>
                    <div className="font-bold text-white">{formatVND(p.price * p.quantity)}</div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-200">TỔNG THÀNH TIỀN:</span>
                <span className="font-extrabold text-base text-emerald-400">{formatVND(invoiceOrder.totalAmount)}</span>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  window.print();
                }}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>In Hóa Đơn (Print)</span>
              </button>

              <button
                onClick={() => setInvoiceOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportCsvOpen && (
        <ImportOrderCsvModal
          isOpen={isImportCsvOpen}
          onClose={() => setIsImportCsvOpen(false)}
          customers={customers}
          products={products}
          onImportOrders={(imported) => {
            if (onImportOrders) {
              onImportOrders(imported);
            }
          }}
        />
      )}

    </div>
  );
};
