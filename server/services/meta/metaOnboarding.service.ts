/**
 * Automatically subscribe Meta App to WABA for incoming Webhooks
 */
export async function ensureWabaSubscribed(wabaId: string, token: string): Promise<boolean> {
  if (!wabaId || !token) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v26.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (res.ok) {
      console.log(`[META WABA SUBSCRIPTION] App successfully subscribed to WABA ${wabaId} for incoming Webhooks!`);
      return true;
    } else {
      const txt = await res.text();
      console.warn(`[META WABA SUBSCRIPTION WARN]`, txt);
    }
  } catch (e: any) {
    console.error(`[META WABA SUBSCRIPTION ERROR]`, e.message || e);
  }
  return false;
}

/** Register a newly onboarded business phone number for Cloud API use. */
export async function registerWhatsAppPhoneNumber(
  phoneNumberId: string,
  token: string,
  pin: string,
): Promise<void> {
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || 'v26.0';
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/register`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error?.message || 'Meta không thể đăng ký số điện thoại cho Cloud API.');
  }
}

/** Start the one-time WhatsApp Business app contact/history synchronization. */
export async function requestSmbAppDataSync(
  phoneNumberId: string,
  token: string,
  syncType: 'smb_app_state_sync' | 'history',
): Promise<string> {
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || 'v26.0';
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/smb_app_data`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.request_id !== 'string') {
    throw new Error(payload?.error?.message || `Meta không thể khởi tạo đồng bộ ${syncType}.`);
  }
  return payload.request_id;
}

/**
 * Fetch phone numbers associated with WABA
 */
export async function fetchWabaPhoneNumbers(wabaId: string, token: string) {
  const metaApiUrl = `https://graph.facebook.com/v26.0/${wabaId}/phone_numbers`;

  const response = await fetch(metaApiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const text = await response.text();
  let responseData: any = {};
  try {
    responseData = text ? JSON.parse(text) : {};
  } catch (e) {
    responseData = { error: { message: text } };
  }

  if (!response.ok) {
    throw new Error(responseData?.error?.message || responseData?.error?.error_user_msg || `Meta API error HTTP ${response.status}`);
  }

  return responseData.data || [];
}

/**
 * Fetch WhatsApp Business Account (WABA) details (name, currency, timezone).
 */
export async function fetchWabaDetails(wabaId: string, token: string): Promise<any> {
  try {
    const metaApiUrl = `https://graph.facebook.com/v26.0/${encodeURIComponent(wabaId)}?fields=id,name,currency,timezone_id`;
    const response = await fetch(metaApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10_000)
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn(`[WABA Details] Không thể lấy thông tin chi tiết WABA ${wabaId}:`, e);
  }
  return null;
}

/**
 * Fetch fields used to identify a WhatsApp Business App Coexistence number.
 * This is kept separate from the WABA list request because Meta does not
 * consistently return coexistence fields on the phone_numbers edge.
 */
export async function fetchWhatsAppPhoneDetails(phoneId: string, token: string) {
  const query = new URLSearchParams({
    fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,platform_type,is_on_biz_app',
  });
  const response = await fetch(
    `https://graph.facebook.com/v26.0/${encodeURIComponent(phoneId)}?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  const responseData: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseData?.error?.message || `Meta API error HTTP ${response.status}`);
  }
  return responseData;
}

/**
 * Fetch the public business profile attached to a WhatsApp phone number.
 */
export async function fetchWhatsAppBusinessProfile(phoneId: string, token: string) {
  try {
    const query = new URLSearchParams({ fields: 'profile_picture_url' });
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${encodeURIComponent(phoneId)}/whatsapp_business_profile?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return null;

    const payload: any = await response.json().catch(() => ({}));
    return payload?.data?.[0] || null;
  } catch {
    return null;
  }
}
