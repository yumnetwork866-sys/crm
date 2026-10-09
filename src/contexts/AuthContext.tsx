import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppUser, UserRole } from '../types';
import { Permission, hasPermission as maskHasPermission } from '../lib/permissions';
import { api, clearLegacyStoredTokens } from '../utils/apiClient';
import { cacheUserRoleColors } from '../utils/roleColors';
import { realtimeClient } from '../services/realtimeClient';

type MessageUserProfile = Pick<AppUser, 'id' | 'name' | 'avatar' | 'role' | 'roleColor' | 'status' | 'lastActive'>;

const mergeMessageProfiles = (current: AppUser[], profiles: MessageUserProfile[]): AppUser[] =>
  profiles.map((profile) => {
    const existing = current.find((user) => user.id === profile.id);
    return {
      ...(existing || {
        email: '',
        phone: '',
        assignedLeadsCount: 0,
        totalRevenue: 0,
      }),
      ...profile,
    };
  });

interface AuthContextValue {
  users: AppUser[];
  currentUser: AppUser | null;
  isAuthLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => void;
  selectUser: (user: AppUser | null) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  hasPermission: (permission: bigint) => boolean;
  saveUser: (data: Partial<AppUser> & { password?: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  changeAvatar: (avatarUrl: string) => Promise<void>;
  refreshCurrentUser: () => Promise<AppUser>;
  refreshUsers: () => Promise<AppUser[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => cacheUserRoleColors(users), [users]);

  useEffect(() => {
    [
      'yumcrm_users_v2',
      'yumcrm_current_user_v2',
      'yumcrm_customers_v2',
      'yumcrm_products_v2',
      'yumcrm_central_messages_v2',
    ].forEach((key) => localStorage.removeItem(key));
    let isCancelled = false;
    void api.get<AppUser>('/auth/me')
      .then((user) => {
        if (isCancelled) return;
        if (!user?.id) throw new Error('Phiên đăng nhập không hợp lệ.');
        clearLegacyStoredTokens();
        setCurrentUser(user);

        // Chỉ tải dữ liệu bảo vệ khi tài khoản có quyền xem danh sách nhân sự.
        if (maskHasPermission(user.effectivePermissions, Permission.USERS_READ)) {
          void api.get<AppUser[]>('/users')
            .then((dbUsers) => {
              if (!isCancelled && Array.isArray(dbUsers)) setUsers(dbUsers);
            })
            .catch(() => null);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        clearLegacyStoredTokens();
        setCurrentUser(null);
      })
      .finally(() => {
        if (!isCancelled) setIsAuthLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let isCancelled = false;
    const refreshMessageProfiles = () => {
      void api.get<MessageUserProfile[]>('/users/message-profiles')
        .then((profiles) => {
          if (!isCancelled && Array.isArray(profiles)) {
            setUsers((current) => mergeMessageProfiles(current, profiles));
          }
        })
        .catch(() => undefined);
    };

    refreshMessageProfiles();
    const unsubscribe = realtimeClient.subscribe({
      'user:profile_updated': (event) => {
        try {
          const profile = JSON.parse(event.data) as MessageUserProfile;
          if (!profile?.id) return;
          setUsers((current) => mergeMessageProfiles(current, [
            ...current
              .filter((user) => user.id !== profile.id)
              .map((user) => ({
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                role: user.role,
                roleColor: user.roleColor,
                status: user.status,
                lastActive: user.lastActive,
              })),
            profile,
          ]));
          setCurrentUser((current) => current?.id === profile.id ? { ...current, ...profile } : current);
        } catch {
          // Ignore malformed realtime profile events.
        }
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [currentUser?.id]);

  const selectUser = useCallback((user: AppUser | null) => {
    if (!user) {
      setCurrentUser(null);
      return;
    }
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
    } catch (error) {
      console.error('[AUTH NETWORK ERROR] POST /api/auth/login', error);
      throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại.', { cause: error });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Email hoặc mật khẩu không chính xác.');
    }
    if (!data.user?.id) {
      throw new Error('Máy chủ không trả về phiên đăng nhập hợp lệ.');
    }

    const authenticatedUser: AppUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      roleColor: data.user.roleColor,
      avatar: data.user.avatar || '',
      phone: data.user.phone || '',
      status: data.user.status || 'active',
      lastActive: 'Đang hoạt động',
      assignedLeadsCount: data.user.assignedLeadsCount || 0,
      totalRevenue: data.user.totalRevenue || 0,
      permissionAllow: data.user.permissionAllow,
      permissionDeny: data.user.permissionDeny,
      effectivePermissions: data.user.effectivePermissions,
    };
    setCurrentUser(authenticatedUser);
    if (maskHasPermission(authenticatedUser.effectivePermissions, Permission.USERS_READ)) {
      try {
        const dbUsers = await api.get<AppUser[]>('/users');
        setUsers(dbUsers);
      } catch {
        setUsers((previous) => previous);
      }
    } else {
      setUsers((previous) => {
        const exists = previous.some(
          (user) => user.id === authenticatedUser.id || user.email.toLowerCase() === authenticatedUser.email.toLowerCase()
        );
        if (!exists) return [authenticatedUser, ...previous];
        return previous.map((user) =>
          user.id === authenticatedUser.id || user.email.toLowerCase() === authenticatedUser.email.toLowerCase()
            ? authenticatedUser
            : user
        );
      });
    }
    return authenticatedUser;
  }, []);

  const logout = useCallback(() => {
    void api.post('/auth/logout').catch(() => undefined);
    clearLegacyStoredTokens();
    setCurrentUser(null);
    setUsers([]);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => Boolean(currentUser && roles.includes(currentUser.role)),
    [currentUser]
  );

  const hasPermission = useCallback(
    (permission: bigint) => maskHasPermission(currentUser?.effectivePermissions, permission),
    [currentUser?.effectivePermissions]
  );

  const saveUser = useCallback(async (data: Partial<AppUser> & { password?: string }) => {
    const payload = {
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone ?? '',
      ...(data.avatar ? { avatar: data.avatar } : {}),
      status: data.status,
      ...(data.password ? { password: data.password } : {}),
      ...(data.permissionAllow !== undefined ? { permissionAllow: data.permissionAllow } : {}),
      ...(data.permissionDeny !== undefined ? { permissionDeny: data.permissionDeny } : {}),
    };

    if (data.id) {
      const updated = await api.put<AppUser>(`/users/${data.id}`, payload);
      setUsers((previous) => previous.map((user) => (user.id === updated.id ? updated : user)));
      setCurrentUser((previous) => previous?.id === updated.id ? updated : previous);
      return;
    }

    const created = await api.post<AppUser>('/users', {
      ...payload,
      email: data.email,
      password: data.password,
    });
    setUsers((previous) => [created, ...previous]);
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi hệ thống?')) return;
    await api.delete(`/users/${userId}`);
    setUsers((previous) => previous.filter((user) => user.id !== userId));
  }, []);

  const toggleUserStatus = useCallback(async (userId: string) => {
    const target = users.find((user) => user.id === userId);
    if (!target) return;
    const updated = await api.put<AppUser>(`/users/${userId}`, {
      status: target.status === 'active' ? 'inactive' : 'active',
    });
    setUsers((previous) => previous.map((user) => user.id === updated.id ? updated : user));
    setCurrentUser((previous) => previous?.id === updated.id ? updated : previous);
  }, [users]);


  const refreshCurrentUser = useCallback(async () => {
    const user = await api.get<AppUser>('/auth/me');
    setCurrentUser(user);
    return user;
  }, []);

  const refreshUsers = useCallback(async () => {
    const dbUsers = await api.get<AppUser[]>('/users');
    setUsers(dbUsers);
    return dbUsers;
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
      isAuthLoading,
      isAdmin: hasPermission(Permission.USERS_MANAGE),
      login,
      logout,
      selectUser,
      hasRole,
      hasPermission,
      saveUser,
      deleteUser,
      toggleUserStatus,
      changePassword,
      changeAvatar,
      refreshCurrentUser,
      refreshUsers,
    }),
    [
      users,
      currentUser,
      isAuthLoading,
      login,
      logout,
      selectUser,
      hasRole,
      hasPermission,
      saveUser,
      deleteUser,
      toggleUserStatus,
      changePassword,
      changeAvatar,
      refreshCurrentUser,
      refreshUsers,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
