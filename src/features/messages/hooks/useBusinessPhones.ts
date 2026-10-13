import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BusinessPhoneNumber } from '../types';
import { api } from '../../../utils/apiClient';
import { queryKeys } from '../../../lib/queryClient';

const SELECTED_PHONE_KEY = 'yumcrm_active_waba_phone';

interface PhoneNumbersResponse {
  success?: boolean;
  phoneNumbers?: Array<Partial<BusinessPhoneNumber> & { id: string }>;
  selectedPhoneNumberId?: string;
}

interface UnreadMessageSummaryResponse {
  total: number;
  byPhone: Array<{ phoneNumberId: string; unreadCount: number }>;
}

export function useBusinessPhones(enabled = true) {
  const [businessPhones, setBusinessPhones] = useState<BusinessPhoneNumber[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState(() => localStorage.getItem(SELECTED_PHONE_KEY) || '');
  const unreadSummaryQuery = useQuery({
    queryKey: queryKeys.messageUnreadTotals,
    queryFn: () => api.get<UnreadMessageSummaryResponse>('/meta/messages/unread-summary'),
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    async function loadPhones() {
      try {
        const payload = await api.get<PhoneNumbersResponse>('/meta/business-phones');
        if (!payload.success || !isMounted) return;
        const phones: BusinessPhoneNumber[] = (payload.phoneNumbers || []).map((phone) => ({
          id: phone.id,
          wabaId: phone.wabaId,
          verifiedName: phone.verifiedName || 'WhatsApp Business',
          displayPhoneNumber: phone.displayPhoneNumber || phone.id,
          profilePictureUrl: phone.profilePictureUrl,
          qualityRating: phone.qualityRating || 'UNKNOWN',
        }));
        setBusinessPhones(phones);

        const saved = localStorage.getItem(SELECTED_PHONE_KEY);
        const selected = phones.find((phone) => phone.id === saved)
          || phones.find((phone) => phone.id === payload.selectedPhoneNumberId)
          || phones[0];
        const nextPhoneId = selected?.id || '';
        setSelectedPhoneId(nextPhoneId);
        if (nextPhoneId) {
          try {
            localStorage.setItem(SELECTED_PHONE_KEY, nextPhoneId);
          } catch {
            // Selection remains active for the current session.
          }
        }
      } catch (error) {
        console.warn('Failed to load Meta WABA phone numbers:', error);
        if (isMounted) {
          setBusinessPhones([]);
          setSelectedPhoneId('');
        }
      }
    }

    void loadPhones();
    return () => { isMounted = false; };
  }, [enabled]);

  const selectBusinessPhone = useCallback((phoneId: string) => {
    setSelectedPhoneId(phoneId);
    try {
      localStorage.setItem(SELECTED_PHONE_KEY, phoneId);
    } catch {
      // Selection remains active for the current session.
    }
  }, []);

  const phonesWithUnreadCounts = useMemo(() => {
    const counts = new Map(
      (unreadSummaryQuery.data?.byPhone || []).map((item) => [item.phoneNumberId, item.unreadCount]),
    );
    return businessPhones.map((phone) => ({
      ...phone,
      unreadCount: counts.get(phone.id) || 0,
    }));
  }, [businessPhones, unreadSummaryQuery.data?.byPhone]);

  return {
    businessPhones: phonesWithUnreadCounts,
    selectedPhoneId,
    selectBusinessPhone,
    unreadMessagesCount: unreadSummaryQuery.data?.total || 0,
  };
}
