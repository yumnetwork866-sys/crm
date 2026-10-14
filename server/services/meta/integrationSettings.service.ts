import { prisma } from '../../lib/prisma';
import { decryptMetaToken } from '../metaTokenCrypto';
import type { IntegrationSettingData } from './types';
import { fetchWabaPhoneNumbers, fetchWhatsAppPhoneDetails } from './metaOnboarding.service';

// In-memory fallback setting store when Database connection (PostgreSQL) is offline or unavailable
let inMemorySetting: IntegrationSettingData = {
  id: 'default',
  whatsappVerifyToken: process.env.META_VERIFY_TOKEN || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappWabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  whatsappAppId: process.env.META_APP_ID || process.env.WHATSAPP_APP_ID || '',
  difyAiEnabled: true,
  status: (process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN) ? 'connected' : 'disconnected',
  lastConnectedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * Retrieve dynamic IntegrationSetting from DB (or fallback in-memory)
 */
export async function getIntegrationSetting(): Promise<IntegrationSettingData> {
  try {
    let setting = await prisma.integrationSetting.findUnique({ where: { id: 'default' } });
    if (!setting) {
      setting = await prisma.integrationSetting.create({
        data: {
          id: 'default',
          whatsappVerifyToken: inMemorySetting.whatsappVerifyToken,
          whatsappPhoneNumberId: inMemorySetting.whatsappPhoneNumberId,
          whatsappWabaId: inMemorySetting.whatsappWabaId,
        }
      });
    }
    // An Embedded Signup connection is authoritative. Legacy environment values
    // remain as a backwards-compatible fallback for installations not onboarded yet.
    const hasEmbeddedConnection = Boolean(setting.whatsappAccessTokenEncrypted);
    const envWabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
    const envToken = (process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN)?.trim();
    const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const envVerifyToken = process.env.META_VERIFY_TOKEN?.trim();
    const envAppId = process.env.META_APP_ID?.trim() || process.env.WHATSAPP_APP_ID?.trim();

    const mergedSetting: IntegrationSettingData = {
      ...setting,
      whatsappWabaId: hasEmbeddedConnection ? (setting.whatsappWabaId || '') : (envWabaId || setting.whatsappWabaId || ''),
      whatsappPhoneNumberId: hasEmbeddedConnection ? (setting.whatsappPhoneNumberId || '') : (envPhoneId || setting.whatsappPhoneNumberId || ''),
      whatsappVerifyToken: envVerifyToken || setting.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
      whatsappAppId: envAppId || setting.whatsappAppId || '',
      status: hasEmbeddedConnection
        ? (setting.status || 'connected')
        : envToken
          ? 'connected'
          : (setting.status || 'disconnected')
    };
    // Sync in-memory store with DB & env
    inMemorySetting = { ...mergedSetting };
    return mergedSetting;
  } catch (dbError) {
    // If PostgreSQL DB connection fails, use in-memory store gracefully
    return inMemorySetting;
  }
}

/**
 * Update integration settings in DB and memory
 */
export async function updateIntegrationSetting(
  data: Partial<IntegrationSettingData>,
  options: { requirePersistence?: boolean } = {},
): Promise<IntegrationSettingData> {
  try {
    const updated = await prisma.integrationSetting.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        whatsappVerifyToken: process.env.META_VERIFY_TOKEN || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
        ...data,
      },
    });
    inMemorySetting = {
      ...updated,
      whatsappVerifyToken: updated.whatsappVerifyToken
        || inMemorySetting.whatsappVerifyToken
        || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
    };
    return inMemorySetting;
  } catch (dbErr) {
    if (options.requirePersistence) throw dbErr;
    inMemorySetting = { ...inMemorySetting, ...data, updatedAt: new Date() };
    return inMemorySetting;
  }
}

/** Resolve the active token without exposing it through an HTTP response. */
export async function getMetaAccessToken(setting?: IntegrationSettingData): Promise<string> {
  const resolvedSetting = setting || await getIntegrationSetting();
  if (
    resolvedSetting.whatsappTokenExpiresAt
    && new Date(resolvedSetting.whatsappTokenExpiresAt).getTime() <= Date.now()
  ) {
    console.warn('[META TOKEN] Access token đã hết hạn; cần chạy lại Embedded Signup.');
    return '';
  }
  if (resolvedSetting.whatsappAccessTokenEncrypted) {
    try {
      return decryptMetaToken(resolvedSetting.whatsappAccessTokenEncrypted);
    } catch (error) {
      console.error('[META TOKEN] Không thể giải mã access token đã lưu:', error instanceof Error ? error.message : error);
      return '';
    }
  }
  return (process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN)?.trim() || '';
}

/** Resolve the System User token used for Commerce Catalog reads. */
export async function getMetaCatalogAccessToken(setting?: IntegrationSettingData): Promise<string> {
  const environmentToken = (process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN)?.trim() || '';
  if (environmentToken) return environmentToken;
  return getMetaAccessToken(setting);
}

export async function getMetaAccessTokenForPhone(
  phoneNumberId: string,
  fallbackSetting?: IntegrationSettingData,
): Promise<string> {
  const normalizedPhoneId = phoneNumberId.trim();
  if (!normalizedPhoneId) return '';

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { phoneNumberId: normalizedPhoneId },
  }).catch(() => null);
  if (connection) {
    if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() <= Date.now()) {
      console.warn(`[META TOKEN] Token của Phone Number ID ${normalizedPhoneId} đã hết hạn.`);
      return '';
    }
    if (connection.accessTokenEncrypted) {
      try {
        return decryptMetaToken(connection.accessTokenEncrypted);
      } catch (error) {
        console.error('[META TOKEN] Không thể giải mã token của kết nối WhatsApp:', error instanceof Error ? error.message : error);
        return '';
      }
    }
    if (connection.usesEnvironmentToken) {
      return (process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN)?.trim() || '';
    }
  }

  const setting = fallbackSetting || await getIntegrationSetting();
  if (setting.whatsappPhoneNumberId === normalizedPhoneId) {
    return getMetaAccessToken(setting);
  }
  return '';
}

export async function syncEnvironmentWhatsAppConnections(): Promise<void> {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || '';
  const token = (process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN)?.trim() || '';
  if (!wabaId || !token) return;

  try {
    const phones = await fetchWabaPhoneNumbers(wabaId, token);
    for (const phone of phones) {
      const phoneNumberId = String(phone?.id || '').trim();
      if (!phoneNumberId) continue;
      const details = await fetchWhatsAppPhoneDetails(phoneNumberId, token).catch(() => phone);
      await prisma.whatsAppConnection.upsert({
        where: { phoneNumberId },
        update: {
          wabaId,
          displayPhoneNumber: details?.display_phone_number || phone?.display_phone_number || null,
          verifiedName: details?.verified_name || phone?.verified_name || null,
          usesEnvironmentToken: true,
          status: 'connected',
        },
        create: {
          phoneNumberId,
          wabaId,
          displayPhoneNumber: details?.display_phone_number || phone?.display_phone_number || null,
          verifiedName: details?.verified_name || phone?.verified_name || null,
          usesEnvironmentToken: true,
          status: 'connected',
        },
      });
    }

    if (phones.length === 1) {
      const legacyPhoneId = String(phones[0]?.id || '').trim();
      const setting = await getIntegrationSetting();
      if (legacyPhoneId && legacyPhoneId !== setting.whatsappPhoneNumberId) {
        await prisma.whatsAppMessage.updateMany({
          where: { businessPhoneNumberId: null },
          data: { businessPhoneNumberId: legacyPhoneId },
        });
      }
    }
  } catch (error) {
    console.warn('[META CONNECTIONS] Không thể đồng bộ kết nối từ biến môi trường:', error instanceof Error ? error.message : error);
  }
}

/**
 * Automatically resolve Phone Number ID from WABA ID if not explicitly specified
 */
export async function resolvePhoneNumberId(setting: IntegrationSettingData): Promise<string> {
  if (setting.whatsappPhoneNumberId && setting.whatsappPhoneNumberId.trim().length > 0) {
    return setting.whatsappPhoneNumberId.trim();
  }
  const wabaId = setting.whatsappWabaId?.trim();
  const token = await getMetaAccessToken(setting);
  if (!wabaId || !token) {
    return '';
  }

  try {
    const metaApiUrl = `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers`;
    const response = await fetch(metaApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data: any = await response.json();
      if (Array.isArray(data?.data) && data.data.length > 0) {
        const autoPhoneId = data.data[0].id;
        const autoPhoneDisplay = data.data[0].display_phone_number || autoPhoneId;
        console.log(`[META AUTO-RESOLVE] Tự động lấy Phone Number ID: ${autoPhoneId} (${autoPhoneDisplay}) từ WABA ID ${wabaId}`);
        setting.whatsappPhoneNumberId = autoPhoneId;
        inMemorySetting.whatsappPhoneNumberId = autoPhoneId;
        return autoPhoneId;
      }
    }
  } catch (err: any) {
    console.warn('[META AUTO-RESOLVE] Không thể tự động lấy Phone Number ID:', err.message || err);
  }
  return '';
}
