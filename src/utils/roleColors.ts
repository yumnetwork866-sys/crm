import type { AppUser } from '../types';

const ROLE_COLOR_STORAGE_KEY = 'yumcrm_role_colors_v1';

const DEFAULT_ROLE_COLORS: Record<string, string> = {
  Admin: '#9333ea',
  'Sales Manager': '#4f46e5',
  'Sales Rep': '#059669',
  'Marketing Lead': '#d97706',
  'Customer Support': '#0891b2',
};

const FALLBACK_ROLE_COLOR = '#475569';

export const loadRoleColorCache = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem(ROLE_COLOR_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
};

let roleColorCache = loadRoleColorCache();

export const cacheRoleColors = (colors: Record<string, string>) => {
  roleColorCache = { ...roleColorCache, ...colors };
  try {
    localStorage.setItem(ROLE_COLOR_STORAGE_KEY, JSON.stringify(roleColorCache));
  } catch {
    // The in-memory cache still prevents color flicker during this session.
  }
};

export const getRoleColor = (role?: string, explicitColor?: string): string =>
  explicitColor || (role ? roleColorCache[role] || DEFAULT_ROLE_COLORS[role] : undefined) || FALLBACK_ROLE_COLOR;

export const getUserRoleColor = (user?: AppUser | null): string =>
  getRoleColor(user?.role, user?.roleColor);

export const cacheUserRoleColors = (users: Array<AppUser | null | undefined>) => {
  cacheRoleColors(Object.fromEntries(
    users
      .filter((user): user is AppUser => Boolean(user?.role && user.roleColor))
      .map((user) => [user.role, user.roleColor as string]),
  ));
};

export const getUserRoleTextStyle = (user?: AppUser | null): React.CSSProperties => {
  const color = getUserRoleColor(user);
  return {
    color,
    WebkitTextFillColor: color,
  };
};

export const findUserByName = (users: AppUser[], name?: string): AppUser | undefined => {
  const normalizedName = name?.trim().toLowerCase();
  if (!normalizedName) return undefined;
  return users.find((user) =>
    user.name.trim().toLowerCase() === normalizedName
    || user.email.trim().toLowerCase() === normalizedName
  );
};
