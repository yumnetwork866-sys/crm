import { parseThreadId, scopeThreadId } from '../../../../shared/whatsappScope';
import type { Customer } from '../../../types';
import type { ConversationSummary } from '../types';
import { isMetaUserIdentifier, isSamePhoneNumber } from '../../../utils/crmUtils';

export function resolveMessageThreadIdentity(
  rawId: string | null | undefined,
  rawPhoneInput: string | null | undefined,
  businessPhoneId: string | undefined,
  { customers, conversations, allPhones, phoneNumberId }: {
    customers: Customer[];
    conversations: ConversationSummary[];
    allPhones: boolean;
    phoneNumberId: string;
  },
) {
  const parsed = parseThreadId(rawId?.trim() || '');
  const candidateId = parsed.threadId;
  const scopedPhoneId = allPhones ? parsed.phoneId || businessPhoneId || '' : phoneNumberId;
  const candidatePhone = rawPhoneInput?.trim() || '';
  if (!candidateId && !candidatePhone) {
    return { threadKey: '', customerId: '', customerPhone: '', businessPhoneId: scopedPhoneId };
  }

  const matchedCustomer = customers.find(
    (item) =>
      (candidateId && item.id === candidateId) ||
      (candidatePhone && item.whatsappRecipientId === candidatePhone) ||
      (candidatePhone && isSamePhoneNumber(item.phone, candidatePhone)) ||
      (candidateId && item.whatsappRecipientId === candidateId.replace(/^meta_/, '')) ||
      (candidateId && isSamePhoneNumber(item.phone, candidateId))
  );

  const matchedConv = conversations.find(
    (item) => (!scopedPhoneId || item.lastMessage.businessPhoneNumberId === scopedPhoneId) && (
      (candidateId && item.customerId === candidateId) ||
      (candidateId === `meta:${item.customerPhone.toLowerCase()}`) ||
      (matchedCustomer && item.customerId === matchedCustomer.id) ||
      (candidatePhone && isSamePhoneNumber(item.customerPhone, candidatePhone)) ||
      (candidateId && isSamePhoneNumber(item.customerPhone, candidateId)))
  );

  const resolvedPhone =
    candidatePhone ||
    matchedCustomer?.whatsappRecipientId ||
    matchedCustomer?.phone ||
    matchedConv?.customerPhone ||
    (candidateId.startsWith('cust_')
      ? candidateId.replace('cust_', '')
      : candidateId.startsWith('phone_')
        ? candidateId.replace('phone_', '')
        : !candidateId.includes('-') && candidateId.replace(/\D/g, '').length >= 7
          ? candidateId
          : '');
  const isUserIdentifier = isMetaUserIdentifier(resolvedPhone);
  const cleanPhone = isUserIdentifier ? '' : resolvedPhone.replace(/\D/g, '');
  const customerIdParam =
    matchedCustomer?.id ||
    matchedConv?.customerId ||
    candidateId ||
    (cleanPhone ? `cust_${cleanPhone}` : '');
  const threadKey =
    matchedCustomer?.id ||
    (isUserIdentifier
      ? `meta:${resolvedPhone.toLowerCase()}`
      : cleanPhone.length >= 7 ? cleanPhone.slice(-9) : customerIdParam);

  const resolvedBusinessPhoneId = scopedPhoneId || matchedConv?.lastMessage.businessPhoneNumberId || '';
  return {
    threadKey: allPhones ? scopeThreadId(resolvedBusinessPhoneId, threadKey) : threadKey,
    businessPhoneId: resolvedBusinessPhoneId,
    customerId: customerIdParam,
    customerPhone: isUserIdentifier ? resolvedPhone : (cleanPhone || resolvedPhone),
  };
}
