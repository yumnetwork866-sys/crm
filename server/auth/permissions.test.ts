import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  Permission,
  calculateEffectivePermissions,
  hasPermission,
  parsePermissionMask,
} from './permissions';

describe('bitfield permissions', () => {
  it('combines role and allow, then applies deny', () => {
    const roleMask = Permission.CUSTOMERS_VIEW | Permission.ORDERS_VIEW;
    const result = calculateEffectivePermissions(
      roleMask,
      Permission.CUSTOMERS_MANAGE,
      Permission.ORDERS_VIEW,
    );

    expect(hasPermission(result, Permission.CUSTOMERS_VIEW)).toBe(true);
    expect(hasPermission(result, Permission.CUSTOMERS_MANAGE)).toBe(true);
    expect(hasPermission(result, Permission.ORDERS_VIEW)).toBe(false);
  });

  it('lets administrator bypass every permission and deny override', () => {
    const result = calculateEffectivePermissions(
      Permission.ADMINISTRATOR,
      0n,
      ALL_PERMISSIONS,
    );

    expect(result).toBe(ALL_PERMISSIONS);
    expect(hasPermission(result, Permission.USERS_MANAGE)).toBe(true);
  });

  it('accepts decimal strings and rejects unknown bits', () => {
    expect(parsePermissionMask(Permission.REPORTS_VIEW.toString())).toBe(Permission.REPORTS_VIEW);
    expect(() => parsePermissionMask((ALL_PERMISSIONS + 1n).toString())).toThrow(/không được hỗ trợ/);
    expect(() => parsePermissionMask(123)).toThrow(/chuỗi số nguyên/);
  });
});
