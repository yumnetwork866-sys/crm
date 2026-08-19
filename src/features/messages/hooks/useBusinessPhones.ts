import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_BUSINESS_PHONES } from '../constants';
import type { BusinessPhoneNumber } from '../types';

const SELECTED_PHONE_KEY = 'yumcrm_active_waba_phone';

interface MetaConfigResponse {
  whatsappWabaId?: string;
  whatsappPhoneNumberId?: string;
  hasAccessToken?: boolean;
}

interface PhoneNumbersResponse {
  success?: boolean;
  phoneNumbers?: Array<Partial<BusinessPhoneNumber> & { id: string }>;
}

export function useBusinessPhones() {
  const [businessPhones, setBusinessPhones] = useState(DEFAULT_BUSINESS_PHONES);
  const [selectedPhoneId, setSelectedPhoneId] = useState(() =>
    localStorage.getItem(SELECTED_PHONE_KEY) || DEFAULT_BUSINESS_PHONES[0].id
  );

  useEffect(() => {
    let isMounted = true;
    async function loadPhones() {
      try {
        const configResponse = await fetch('/api/meta/config');
        if (!configResponse.ok) return;
        const config = await configResponse.json() as MetaConfigResponse;

        if (config.whatsappWabaId && config.hasAccessToken) {
          const phonesResponse = await fetch('/api/meta/fetch-phone-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wabaId: config.whatsappWabaId }),
          });
          if (phonesResponse.ok) {
            const payload = await phonesResponse.json() as PhoneNumbersResponse;
            if (payload.success && payload.phoneNumbers?.length && isMounted) {
              const phones = payload.phoneNumbers.map((phone) => ({
                id: phone.id,
                verifiedName: phone.verifiedName || 'Yum Network WABA',
                displayPhoneNumber: phone.displayPhoneNumber || phone.id,
                qualityRating: phone.qualityRating || 'GREEN',
              }));
              setBusinessPhones(phones);
              const saved = localStorage.getItem(SELECTED_PHONE_KEY);
              const selected = phones.find((phone) =>
                phone.id === saved || phone.id === config.whatsappPhoneNumberId
              ) || phones[0];
              setSelectedPhoneId(selected.id);
              return;
            }
          }
        }

        if (config.whatsappPhoneNumberId && isMounted) {
          const configured = DEFAULT_BUSINESS_PHONES.find((phone) =>
            phone.id === config.whatsappPhoneNumberId
            || phone.displayPhoneNumber.replace(/\D/g, '') === config.whatsappPhoneNumberId?.replace(/\D/g, '')
          );
          if (configured) setSelectedPhoneId(configured.id);
        }
      } catch (error) {
        console.warn('Failed to load Meta WABA phone numbers:', error);
      }
    }

    void loadPhones();
    return () => { isMounted = false; };
  }, []);

  const selectBusinessPhone = useCallback((phoneId: string) => {
    setSelectedPhoneId(phoneId);
    try {
      localStorage.setItem(SELECTED_PHONE_KEY, phoneId);
    } catch {
      // Selection remains active for the current session.
    }
    if (!phoneId.startsWith('phone_')) {
      void fetch('/api/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappPhoneNumberId: phoneId }),
      }).catch(() => undefined);
    }
  }, []);

  return { businessPhones, selectedPhoneId, selectBusinessPhone };
}
