import React, { useRef, useState } from 'react';
import type { AppUser, PermissionDefinition, RolePermissionPolicy, UserRole } from '../../../types';
import { api } from '../../../utils/apiClient';
import { Permission } from '../../../lib/permissions';
import { cacheRoleColors } from '../../../utils/roleColors';
import {
  ShieldCheck,
  Edit2,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  RotateCcw,
  ChevronRight,
  Plus,
  X,
  Check,
} from 'lucide-react';

export const ROLE_COLOR_PRESETS = [
  '#e11d48',
  '#d97706',
  '#2563eb',
  '#059669',
  '#9333ea',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#475569',
] as const;

const FALLBACK_ROLE_COLOR = '#475569';

interface RolePermissionsMatrixTabProps {
  currentUser: AppUser | null;
  permissionDefinitions: PermissionDefinition[];
  rolePolicies: RolePermissionPolicy[];
  setRolePolicies: React.Dispatch<React.SetStateAction<RolePermissionPolicy[]>>;
  permissionDrafts: Record<string, string>;
  setPermissionDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  roleColorDrafts: Record<string, string>;
  setRoleColorDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paletteColors: string[];
  setPaletteColors: React.Dispatch<React.SetStateAction<string[]>>;
  permissionsLoading: boolean;
  permissionsError: string;
  setPermissionsError: React.Dispatch<React.SetStateAction<string>>;
  selectedRole: UserRole;
  setSelectedRole: React.Dispatch<React.SetStateAction<UserRole>>;
  getRoleColor: (role: UserRole) => string;
  getRoleTextStyle: (role: UserRole) => React.CSSProperties;
  refreshUsers: () => Promise<unknown>;
  refreshCurrentUser: () => Promise<unknown>;
}

export const RolePermissionsMatrixTab: React.FC<RolePermissionsMatrixTabProps> = ({
  currentUser,
  permissionDefinitions,
  rolePolicies,
  setRolePolicies,
  permissionDrafts,
  setPermissionDrafts,
  roleColorDrafts,
  setRoleColorDrafts,
  paletteColors,
  setPaletteColors,
  permissionsLoading,
  permissionsError,
  setPermissionsError,
  selectedRole,
  setSelectedRole,
  getRoleColor,
  getRoleTextStyle,
  refreshUsers,
  refreshCurrentUser,
}) => {
  const customColorInputRef = useRef<HTMLInputElement>(null);
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);
  const [roleEditorMode, setRoleEditorMode] = useState<'create' | 'rename' | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleActionLoading, setRoleActionLoading] = useState(false);

  const togglePermission = (role: UserRole, definition: PermissionDefinition) => {
    if (role === 'Admin' && definition.bit === Permission.USERS_MANAGE.toString()) return;
    setPermissionDrafts((previous) => {
      const current = BigInt(previous[role] || '0');
      return { ...previous, [role]: (current ^ BigInt(definition.bit)).toString() };
    });
  };

  const selectedPolicy = rolePolicies.find((policy) => policy.role === selectedRole);
  const selectedMask = BigInt(permissionDrafts[selectedRole] || '0');
  const selectedRoleIsDirty = Boolean(
    selectedPolicy && (
      permissionDrafts[selectedRole] !== selectedPolicy.permissions
      || roleColorDrafts[selectedRole] !== selectedPolicy.color
    )
  );

  const permissionGroups = permissionDefinitions.reduce<Array<{ name: string; permissions: PermissionDefinition[] }>>(
    (groups, definition) => {
      const currentGroup = groups.at(-1);
      if (currentGroup?.name === definition.group) currentGroup.permissions.push(definition);
      else groups.push({ name: definition.group, permissions: [definition] });
      return groups;
    },
    []
  );

  const resetRolePermissions = () => {
    if (!selectedPolicy) return;
    setPermissionDrafts((previous) => ({
      ...previous,
      [selectedRole]: selectedPolicy.permissions,
    }));
    setRoleColorDrafts((previous) => ({
      ...previous,
      [selectedRole]: selectedPolicy.color,
    }));
    setPermissionsError('');
  };

  const saveRolePermissions = async (role: UserRole) => {
    setSavingRole(role);
    setPermissionsError('');
    try {
      const updated = await api.put<RolePermissionPolicy>(`/permissions/roles/${encodeURIComponent(role)}`, {
        permissions: permissionDrafts[role],
        color: roleColorDrafts[role] ?? FALLBACK_ROLE_COLOR,
      });
      setRolePolicies((previous) => previous.map((policy) => policy.role === role ? updated : policy));
      setPermissionDrafts((previous) => ({ ...previous, [role]: updated.permissions }));
      setRoleColorDrafts((previous) => ({ ...previous, [role]: updated.color }));
      cacheRoleColors({ [role]: updated.color });
      await refreshUsers();
      if (currentUser?.role === role) await refreshCurrentUser();
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : 'Không thể lưu phân quyền.');
    } finally {
      setSavingRole(null);
    }
  };

  const openCreateRole = () => {
    setRoleEditorMode('create');
    setRoleName('');
    setPermissionsError('');
  };

  const openRenameRole = () => {
    setRoleEditorMode('rename');
    setRoleName(selectedRole);
    setPermissionsError('');
  };

  const submitRoleEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roleName.trim()) return;
    setRoleActionLoading(true);
    setPermissionsError('');
    try {
      if (roleEditorMode === 'create') {
        const created = await api.post<RolePermissionPolicy>('/permissions/roles', { name: roleName });
        setRolePolicies((previous) => [...previous, created].sort((a, b) => a.role.localeCompare(b.role)));
        setPermissionDrafts((previous) => ({ ...previous, [created.role]: created.permissions }));
        setRoleColorDrafts((previous) => ({ ...previous, [created.role]: created.color }));
        cacheRoleColors({ [created.role]: created.color });
        setSelectedRole(created.role);
      } else if (roleEditorMode === 'rename') {
        const previousRole = selectedRole;
        const updated = await api.patch<RolePermissionPolicy>(
          `/permissions/roles/${encodeURIComponent(previousRole)}`,
          { name: roleName },
        );
        setRolePolicies((previous) => previous
          .map((policy) => policy.role === previousRole ? updated : policy)
          .sort((a, b) => a.role.localeCompare(b.role)));
        setPermissionDrafts((previous) => {
          const { [previousRole]: oldDraft, ...remaining } = previous;
          return { ...remaining, [updated.role]: oldDraft ?? updated.permissions };
        });
        setRoleColorDrafts((previous) => {
          const { [previousRole]: oldColor, ...remaining } = previous;
          const nextColor = oldColor ?? updated.color;
          cacheRoleColors({ [updated.role]: nextColor });
          return { ...remaining, [updated.role]: nextColor };
        });
        setSelectedRole(updated.role);
        await refreshUsers();
        if (currentUser?.role === previousRole) await refreshCurrentUser();
      }
      setRoleEditorMode(null);
      setRoleName('');
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : 'Không thể cập nhật vai trò.');
    } finally {
      setRoleActionLoading(false);
    }
  };

  const deleteSelectedRole = async () => {
    const policy = rolePolicies.find((item) => item.role === selectedRole);
    if (!policy || selectedRole === 'Admin') return;
    if (policy.userCount > 0) {
      setPermissionsError(`Vai trò đang được gán cho ${policy.userCount} tài khoản. Hãy chuyển các tài khoản sang vai trò khác trước khi xóa.`);
      return;
    }
    if (!confirm(`Xóa vai trò “${selectedRole}”? Thao tác này không thể hoàn tác.`)) return;
    setRoleActionLoading(true);
    setPermissionsError('');
    try {
      await api.delete(`/permissions/roles/${encodeURIComponent(selectedRole)}`);
      const remaining = rolePolicies.filter((item) => item.role !== selectedRole);
      setRolePolicies(remaining);
      setPermissionDrafts((previous) => {
        const { [selectedRole]: _removed, ...rest } = previous;
        return rest;
      });
      setRoleColorDrafts((previous) => {
        const { [selectedRole]: _removed, ...rest } = previous;
        return rest;
      });
      setSelectedRole(remaining.find((item) => item.role === 'Admin')?.role || remaining[0]?.role || 'Admin');
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : 'Không thể xóa vai trò.');
    } finally {
      setRoleActionLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-black text-slate-950">Phân Quyền Vai Trò</h2>
        </div>
        <button
          type="button"
          onClick={openCreateRole}
          disabled={roleActionLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Thêm vai trò
        </button>
      </div>

      {roleEditorMode && (
        <form
          onSubmit={(event) => void submitRoleEditor(event)}
          className="mx-5 mt-5 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:mx-6 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1 text-xs font-extrabold text-slate-800">
            {roleEditorMode === 'create' ? 'Tên vai trò mới' : `Đổi tên “${selectedRole}”`}
            <input
              autoFocus
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              maxLength={50}
              placeholder="Ví dụ: Trưởng nhóm CSKH"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRoleEditorMode(null)}
              disabled={roleActionLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Hủy
            </button>
            <button
              type="submit"
              disabled={roleActionLoading || roleName.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {roleActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {roleEditorMode === 'create' ? 'Tạo vai trò' : 'Lưu tên'}
            </button>
          </div>
        </form>
      )}

      {permissionsError && (
        <div className="mx-5 mt-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 sm:mx-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {permissionsError}
        </div>
      )}

      {permissionsLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm font-bold text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải phân quyền...
        </div>
      ) : (
        <div className="grid min-h-150 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-3 lg:border-r lg:border-b-0">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
              {rolePolicies.map((policy) => {
                const role = policy.role;
                const active = selectedRole === role;
                const dirty = permissionDrafts[role] !== policy.permissions
                  || roleColorDrafts[role] !== policy.color;
                return (
                  <div
                    key={role}
                    className={`group flex min-w-60 items-center rounded-xl border transition lg:min-w-0 lg:w-full ${
                      active
                        ? 'border-indigo-200 bg-white text-indigo-800 shadow-sm'
                        : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-xs font-extrabold"
                          style={getRoleTextStyle(role)}
                        >
                          {role}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{policy.userCount} tài khoản</span>
                      </span>
                      {dirty ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Chưa lưu" />
                      ) : (
                        <ChevronRight className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-500' : 'text-slate-300'}`} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="relative bg-slate-50/30 p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3
                  className="text-base font-black"
                  style={getRoleTextStyle(selectedRole)}
                >
                  {selectedRole}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openRenameRole}
                  disabled={selectedRole === 'Admin' || roleActionLoading}
                  title={selectedRole === 'Admin' ? 'Không thể đổi tên vai trò Admin hệ thống.' : 'Đổi tên vai trò'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Đổi tên
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSelectedRole()}
                  disabled={selectedRole === 'Admin' || roleActionLoading}
                  title={selectedRole === 'Admin' ? 'Không thể xóa vai trò Admin hệ thống.' : 'Xóa vai trò'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Xóa
                </button>
              </div>
            </div>

            <div className="space-y-4 pb-20">
              <fieldset>
                <div className="flex flex-wrap items-center gap-2">
                  {paletteColors.map((color) => {
                    const isSelected = getRoleColor(selectedRole) === color;
                    return (
                      <div key={color} className="group relative">
                        <button
                          type="button"
                          onClick={() => setRoleColorDrafts((previous) => ({ ...previous, [selectedRole]: color }))}
                          disabled={savingRole !== null}
                          aria-label={`Chọn màu ${color}`}
                          aria-pressed={isSelected}
                          title={color.toUpperCase()}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                            isSelected ? 'scale-110 ring-2 ring-slate-700 ring-offset-2' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {isSelected ? <Check className="h-4 w-4 text-white drop-shadow-sm" /> : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaletteColors((current) => {
                              const remaining = current.filter((item) => item !== color);
                              if (isSelected) {
                                setRoleColorDrafts((previous) => ({
                                  ...previous,
                                  [selectedRole]: remaining[0] || ROLE_COLOR_PRESETS[0],
                                }));
                              }
                              return remaining;
                            });
                          }}
                          disabled={savingRole !== null}
                          aria-label={`Xóa màu ${color}`}
                          title="Xóa màu"
                          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300 group-hover:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => customColorInputRef.current?.click()}
                    disabled={savingRole !== null}
                    aria-label="Thêm màu mới"
                    title="Thêm màu mới"
                    className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white text-slate-500 transition hover:scale-110 hover:border-slate-500 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <input
                    ref={customColorInputRef}
                    type="color"
                    value={getRoleColor(selectedRole)}
                    onChange={(event) => {
                      const color = event.target.value.toLowerCase();
                      setRoleColorDrafts((previous) => ({ ...previous, [selectedRole]: color }));
                      setPaletteColors((current) => current.includes(color) ? current : [...current, color]);
                    }}
                    disabled={savingRole !== null}
                    aria-label="Thêm màu mới"
                    className="pointer-events-none absolute h-px w-px opacity-0"
                    tabIndex={-1}
                  />
                </div>
              </fieldset>

              {permissionGroups.map((group) => (
                <div key={group.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {group.name}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.permissions.map((definition) => {
                      const enabled = (selectedMask & BigInt(definition.bit)) === BigInt(definition.bit);
                      const locked = selectedRole === 'Admin' && definition.bit === Permission.USERS_MANAGE.toString();
                      return (
                        <button
                          key={definition.key}
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          disabled={locked || savingRole !== null}
                          onClick={() => togglePermission(selectedRole, definition)}
                          className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed"
                          title={locked ? 'Admin phải giữ quyền quản lý tài khoản.' : undefined}
                        >
                          <span className="min-w-0 flex-1 text-xs font-extrabold text-slate-800">
                            {definition.label}
                          </span>
                          {locked && (
                            <span className="hidden text-[10px] font-bold text-slate-400 sm:inline">Bắt buộc</span>
                          )}
                          <span
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                              enabled ? 'bg-indigo-600' : 'bg-slate-300'
                            } ${locked ? 'opacity-60' : ''}`}
                          >
                            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              enabled ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selectedRoleIsDirty && (
              <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col gap-3 rounded-2xl border border-indigo-200 bg-white px-4 py-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
                <span
                  className="text-xs font-bold"
                  style={{ color: '#dc2626', WebkitTextFillColor: '#dc2626' }}
                >
                  Bạn có thay đổi chưa lưu
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingRole !== null}
                    onClick={resetRolePermissions}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-100 sm:flex-none"
                  >
                    <RotateCcw className="h-4 w-4" /> Hoàn tác
                  </button>
                  <button
                    type="button"
                    disabled={savingRole !== null}
                    onClick={() => void saveRolePermissions(selectedRole)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 sm:flex-none"
                  >
                    {savingRole === selectedRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingRole === selectedRole ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
