import { useCallback, useEffect, useState } from 'react';
import type { BusinessPhoneNumber } from '../types';
import { api } from '../../../utils/apiClient';

const SELECTED_PHONE_KEY = 'yumcrm_active_waba_phone';

interface PhoneNumbersResponse {
  success?: boolean;
  phoneNumbers?: Array<Partial<BusinessPhoneNumber> & { id: string }>;
  selectedPhoneNumberId?: string;
}

export function useBusinessPhones(enabled = true) {
  const [businessPhones, setBusinessPhones] = useState<BusinessPhoneNumber[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState(() => localStorage.getItem(SELECTED_PHONE_KEY) || '');

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

  return { businessPhones, selectedPhoneId, selectBusinessPhone };
}
