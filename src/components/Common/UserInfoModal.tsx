import { Activity, Mail, Phone, ShieldCheck, X } from 'lucide-react';
import type { AppUser } from '../../types';
import { getUserRoleColor, getUserRoleTextStyle } from '../../utils/roleColors';

interface UserInfoModalProps {
  user: AppUser | null;
  onClose: () => void;
}

export const UserInfoModal: React.FC<UserInfoModalProps> = ({ user, onClose }) => {
  if (!user) return null;

  const roleColor = getUserRoleColor(user);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-info-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: roleColor }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông tin người dùng"
          title="Đóng"
          className="absolute right-4 top-5 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-4 pr-8">
            <img
              src={user.avatar || `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`}
              alt={user.name}
              className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm"
            />
            <div className="min-w-0">
              <h2
                id="user-info-title"
                className="truncate text-lg font-black"
                style={getUserRoleTextStyle(user)}
              >
                {user.name}
              </h2>
              <span
                className="mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold"
                style={{
                  ...getUserRoleTextStyle(user),
                  backgroundColor: `${roleColor}18`,
                  borderColor: `${roleColor}55`,
                }}
              >
                {user.role}
              </span>
            </div>
          </div>

          <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/70 px-4">
            <div className="flex items-center gap-3 py-3">
              <Mail className="h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Email</div>
                <div className="truncate text-sm font-semibold text-slate-900">{user.email || 'Chưa cập nhật'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 py-3">
              <Phone className="h-4 w-4 shrink-0 text-slate-500" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Điện thoại</div>
                <div className="text-sm font-semibold text-slate-900">{user.phone || 'Chưa cập nhật'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 py-3">
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: roleColor }} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vai trò</div>
                <div className="text-sm font-bold" style={getUserRoleTextStyle(user)}>{user.role}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 py-3">
              <Activity className={`h-4 w-4 shrink-0 ${user.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</div>
                <div className={`text-sm font-bold ${user.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {user.status === 'active' ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
