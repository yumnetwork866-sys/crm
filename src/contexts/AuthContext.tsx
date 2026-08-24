import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { INITIAL_USERS } from '../data/mockData';
import type { AppUser, UserRole } from '../types';
import { api, removeStoredToken, setStoredToken } from '../utils/apiClient';

const STORAGE_KEY_USERS = 'yumcrm_users_v2';
const STORAGE_KEY_CURRENT_USER = 'yumcrm_current_user_v2';

const loadUsers = (): AppUser[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  } catch {
    return INITIAL_USERS;
  }
};

const loadCurrentUser = (): AppUser | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

interface AuthContextValue {
  users: AppUser[];
  currentUser: AppUser | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => void;
  selectUser: (user: AppUser | null) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  saveUser: (data: Partial<AppUser> & { password?: string }) => void;
  deleteUser: (userId: string) => void;
  toggleUserStatus: (userId: string) => void;
  switchUser: (user: AppUser) => void;
  resetAuth: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  changeAvatar: (avatarUrl: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(loadUsers);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(loadCurrentUser);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (error) {
      console.error('Error saving users to localStorage', error);
    }
  }, [users]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      }
    } catch (error) {
      console.error('Error saving current user to localStorage', error);
    }
  }, [currentUser]);

  useEffect(() => {
    // Kiểm tra token và khôi phục thông tin đăng nhập từ backend
    api.get<AppUser>('/auth/me')
      .then((user) => {
        if (user && user.id) {
          setCurrentUser(user);
        }
      })
      .catch(() => null);

    // Tự động tải danh sách người dùng từ DB nếu có quyền
    api.get<AppUser[]>('/users')
      .then((dbUsers) => {
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          setUsers(dbUsers);
        }
      })
      .catch(() => null);
  }, []);

  const selectUser = useCallback((user: AppUser | null) => {
    if (!user) removeStoredToken();
    setCurrentUser(user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: password.trim() }),
      });
    } catch {
      const localUser = users.find(
        (user) => user.email.toLowerCase() === cleanEmail || (cleanEmail === 'admin' && user.role === 'Admin')
      );
      if (!localUser) {
        if (cleanEmail === 'admin') {
          const fallbackAdmin: AppUser = {
            id: 'usr_001',
            name: 'Quản Trị Viên (Admin)',
            email: 'admin',
            role: 'Admin',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
            phone: '',
            department: 'Ban Giám Đốc',
            status: 'active',
            lastActive: 'Đang hoạt động',
            assignedLeadsCount: 0,
            totalRevenue: 0,
          };
          setCurrentUser(fallbackAdmin);
          return fallbackAdmin;
        }
        throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại.');
      }
      if (localUser.status === 'inactive') throw new Error('Tài khoản này đang bị vô hiệu hóa.');
      setCurrentUser(localUser);
      return localUser;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Email hoặc mật khẩu không chính xác.');
    }
    if (data.token) setStoredToken(data.token);

    const authenticatedUser: AppUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      avatar: data.user.avatar || '',
      phone: data.user.phone || '',
      department: data.user.department || 'Sales',
      status: data.user.status || 'active',
      lastActive: 'Đang hoạt động',
      assignedLeadsCount: data.user.assignedLeadsCount || 0,
      totalRevenue: data.user.totalRevenue || 0,
    };
    setCurrentUser(authenticatedUser);
    setUsers((prev) => {
      const exists = prev.some(
        (u) => u.id === authenticatedUser.id || u.email.toLowerCase() === authenticatedUser.email.toLowerCase()
      );
      if (exists) {
        return prev.map((u) =>
          u.id === authenticatedUser.id || u.email.toLowerCase() === authenticatedUser.email.toLowerCase()
            ? authenticatedUser
            : u
        );
      }
      return [authenticatedUser, ...prev];
    });
    return authenticatedUser;
  }, [users]);

  const logout = useCallback(() => {
    removeStoredToken();
    setCurrentUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => Boolean(currentUser && roles.includes(currentUser.role)),
    [currentUser]
  );

  const saveUser = useCallback((data: Partial<AppUser> & { password?: string }) => {
    if (data.id) {
      setUsers((previous) =>
        previous.map((user) => (user.id === data.id ? ({ ...user, ...data } as AppUser) : user))
      );
      setCurrentUser((previous) =>
        previous?.id === data.id ? ({ ...previous, ...data } as AppUser) : previous
      );
      api.put(`/users/${data.id}`, data).catch(() => null);
      return;
    }

    const newUser: AppUser = {
      id: `usr_${Date.now()}`,
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      role: data.role || 'Sales Rep',
      department: data.department || 'Phòng Sales',
      status: data.status || 'active',
      avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      lastActive: 'Vừa kích hoạt',
      assignedLeadsCount: 0,
      totalRevenue: 0,
    };
    setUsers((previous) => [...previous, newUser]);
    api.post('/users', { ...newUser, password: data.password || 'admin123' }).catch(() => null);
  }, []);

  const deleteUser = useCallback((userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi hệ thống?')) return;
    setUsers((previous) => previous.filter((user) => user.id !== userId));
    setCurrentUser((previous) => {
      if (previous?.id !== userId) return previous;
      removeStoredToken();
      return null;
    });
  }, []);

  const toggleUserStatus = useCallback((userId: string) => {
    setUsers((previous) =>
      previous.map((user) =>
        user.id === userId
          ? { ...user, status: user.status === 'active' ? 'inactive' : 'active' }
          : user
      )
    );
  }, []);

  const switchUser = useCallback((user: AppUser) => {
    if (user.status === 'inactive') {
      alert('Tài khoản này đang ở trạng thái Inactive (vô hiệu hóa).');
      return;
    }
    setCurrentUser(user);
    alert(`Đã chuyển tài khoản thành công sang: ${user.name} (${user.role})`);
  }, []);

  const resetAuth = useCallback(() => {
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { oldPassword, newPassword });
  }, []);

  const changeAvatar = useCallback(async (avatarUrl: string) => {
    const res = await api.post<{ message: string; user: AppUser }>('/auth/change-avatar', { avatar: avatarUrl });
    if (res && res.user) {
      setCurrentUser(res.user);
      setUsers((prev) => prev.map((u) => u.id === res.user.id ? { ...u, avatar: avatarUrl } : u));
    } else {
      setCurrentUser((prev) => prev ? { ...prev, avatar: avatarUrl } : null);
      setUsers((prev) => prev.map((u) => u.id === currentUser?.id ? { ...u, avatar: avatarUrl } : u));
    }
  }, [currentUser?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      users,
      currentUser,
      isAdmin: currentUser?.role === 'Admin',
      login,
      logout,
      selectUser,
      hasRole,
      saveUser,
      deleteUser,
      toggleUserStatus,
      switchUser,
      resetAuth,
      changePassword,
      changeAvatar,
    }),
    [
      users,
      currentUser,
      login,
      logout,
      selectUser,
      hasRole,
      saveUser,
      deleteUser,
      toggleUserStatus,
      switchUser,
      resetAuth,
      changePassword,
      changeAvatar,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
