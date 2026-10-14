import { prisma } from '../../lib/prisma';
import { getIntegrationSetting } from '../metaApiClient';
import { realtimeHub } from '../realtimeHub';
import { getPhoneLookupVariants, normalizePhoneE164 } from '../../utils/phone';
import { isMetaUserIdentifier, normalizeMetaRecipient } from '../../utils/metaRecipient';

/**
 * Verifies webhook subscription request from Meta
 */
export async function verifyWebhookChallenge(query: any): Promise<{ isValid: boolean; challenge?: string }> {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  const setting = await getIntegrationSetting();
  const validTokens = [
    setting.whatsappVerifyToken,
    process.env.META_VERIFY_TOKEN,
  ].filter(Boolean).map((t) => String(t).trim());

  console.log(`[META WEBHOOK VERIFY REQUEST] Received mode: "${mode}", token: "${token}"`);

  if (mode === 'subscribe' && token && validTokens.includes(String(token).trim())) {
    console.log('Meta Webhook Verified Successfully! Returning challenge:', challenge);
    return { isValid: true, challenge: String(challenge) };
  }

  console.warn(`Meta Webhook Verification Failed. Expected Token: "${validTokens.join(' | ')}", Received Token: "${token}"`);
  return { isValid: false };
}

export async function resolveWhatsAppBrandName(businessPhoneNumberId?: string | null): Promise<string | undefined> {
  if (!businessPhoneNumberId) return undefined;
  const conn = await prisma.whatsAppConnection.findUnique({
    where: { phoneNumberId: businessPhoneNumberId },
    select: { verifiedName: true, displayPhoneNumber: true }
  }).catch(() => null);
  return conn?.verifiedName || conn?.displayPhoneNumber || undefined;
}

/**
 * Match incoming phone number to an existing CRM customer or auto-create a new CRM customer
 */
export async function matchCustomerByPhone(
  fromPhone: string,
  senderName: string,
  businessPhoneNumberId?: string
): Promise<{ customerId: string; customerName: string; isCrmCustomer: boolean }> {
  const isUserIdentifier = isMetaUserIdentifier(fromPhone);
  const recipientId = normalizeMetaRecipient(fromPhone);
  const cleanFrom = fromPhone.replace(/\D/g, '');
  const e164Phone = isUserIdentifier ? '' : normalizePhoneE164(fromPhone);
  let matchedCustomerId = isUserIdentifier ? `meta_${fromPhone}` : `cust_${cleanFrom}`;
  let matchedCustomerName = senderName;
  let isCrmCustomer = false;

  try {
    if (isUserIdentifier) {
      const matchedCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { whatsappRecipientId: fromPhone },
            { phone: fromPhone },
          ],
        },
        select: { id: true, name: true },
      });
      if (matchedCustomer) {
        await prisma.customer.update({
          where: { id: matchedCustomer.id },
          data: { lastContact: new Date() },
        }).catch(() => {});
        realtimeHub.broadcast('customers:sync', { source: 'whatsapp-activity', customerId: matchedCustomer.id });
        return {
          customerId: matchedCustomer.id,
          customerName: matchedCustomer.name || senderName,
          isCrmCustomer: true,
        };
      }

      const brandName = await resolveWhatsAppBrandName(businessPhoneNumberId);
      const newCustomer = await prisma.customer.create({
        data: {
          phone: '',
          whatsappRecipientId: fromPhone,
          name: senderName || fromPhone,
          source: 'WhatsApp',
          campaign: brandName || 'N/A',
          status: 'New Lead',
          group: 'group_1',
          firstContact: new Date(),
          lastContact: new Date(),
          ownerId: null,
        },
      });
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-auto-create', customerId: newCustomer.id });
      return { customerId: newCustomer.id, customerName: newCustomer.name, isCrmCustomer: true };
    }

    const phoneVariants = getPhoneLookupVariants(fromPhone);

    const matchedCustomer = phoneVariants.length > 0
      ? await prisma.customer.findFirst({
          where: {
            OR: [
              { phone: { in: phoneVariants } },
              ...(recipientId ? [{ whatsappRecipientId: recipientId }] : []),
            ],
          },
          select: { id: true, name: true, phone: true, whatsappRecipientId: true, campaign: true }
        })
      : null;

    if (matchedCustomer) {
      matchedCustomerId = matchedCustomer.id;
      matchedCustomerName = matchedCustomer.name || senderName;
      isCrmCustomer = true;
      const brandName = await resolveWhatsAppBrandName(businessPhoneNumberId);
      const updateData: any = { lastContact: new Date() };
      if (recipientId && matchedCustomer.whatsappRecipientId !== recipientId) {
        updateData.whatsappRecipientId = recipientId;
      }
      if (e164Phone && matchedCustomer.phone !== e164Phone) {
        updateData.phone = e164Phone;
      }
      if (brandName && (!matchedCustomer.campaign || ['N/A', 'n/a', 'NA', 'na', 'Default Campaign', ''].includes(matchedCustomer.campaign.trim()))) {
        updateData.campaign = brandName;
      }
      // Auto-update lastContact and brand on the existing CRM customer
      await prisma.customer.update({
        where: { id: matchedCustomer.id },
        data: updateData
      }).catch(() => {});
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-activity', customerId: matchedCustomer.id });
      console.log(`[WEBHOOK CUSTOMER MATCH] Matched incoming phone ${fromPhone} to CRM customer: ${matchedCustomer.name} (${matchedCustomer.id})`);
    } else if (cleanFrom.length >= 7 && e164Phone) {
      // Auto-create new customer in CRM so they immediately appear in the Customer page
      const defaultName = (senderName && !senderName.startsWith('Khách WhatsApp'))
        ? senderName
        : `Khách WhatsApp (${cleanFrom.slice(-4)})`;
      const brandName = await resolveWhatsAppBrandName(businessPhoneNumberId);

      const newCustomer = await prisma.customer.create({
        data: {
          phone: e164Phone,
          whatsappRecipientId: recipientId || null,
          name: defaultName,
          source: 'WhatsApp',
          campaign: brandName || 'N/A',
          status: 'New Lead',
          group: 'group_1',
          firstContact: new Date(),
          lastContact: new Date(),
          ownerId: null,
        }
      });
      matchedCustomerId = newCustomer.id;
      matchedCustomerName = newCustomer.name;
      isCrmCustomer = true;
      console.log(`[WEBHOOK AUTO-CREATED CUSTOMER] Auto-created CRM customer ${newCustomer.name} (${newCustomer.id}) for phone ${e164Phone} from brand ${brandName || 'N/A'}`);
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-auto-create', customerId: newCustomer.id });
    }
  } catch (lookupErr) {
    console.warn('[WEBHOOK CUSTOMER LOOKUP ERROR]', lookupErr);
  }

  return { customerId: matchedCustomerId, customerName: matchedCustomerName, isCrmCustomer };
}

/**
 * Automatically sync and provision CRM customers for any WhatsApp conversations that lack customer records
 */
export async function syncExistingWhatsAppCustomersToCrm(): Promise<number> {
  try {
    const unlinkedMessages = await prisma.whatsAppMessage.findMany({
      where: {
        OR: [
          { customerId: null },
          { customerId: { startsWith: 'cust_' } }
        ]
      },
      select: {
        id: true,
        customerPhone: true,
        recipientId: true,
        customerName: true,
        businessPhoneNumberId: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'asc' }
    });

    let syncedCount = 0;
    if (unlinkedMessages.length > 0) {
      const phoneGroups = new Map<string, { phone: string; recipientId: string; name: string; firstDate: Date; lastDate: Date; businessPhoneNumberId?: string; messageIds: string[] }>();
      for (const msg of unlinkedMessages) {
        const recipientId = normalizeMetaRecipient(msg.recipientId || msg.customerPhone);
        if (!recipientId) continue;
        const isUserIdentifier = isMetaUserIdentifier(recipientId);
        const clean = (msg.customerPhone || '').replace(/\D/g, '');
        const e164 = isUserIdentifier ? '' : normalizePhoneE164(msg.customerPhone);
        if (!isUserIdentifier && (clean.length < 7 || !e164)) continue;
        const groupKey = recipientId.toLowerCase();
        const existing = phoneGroups.get(groupKey);
        const msgDate = new Date(msg.timestamp);
        if (!existing) {
          phoneGroups.set(groupKey, {
            phone: e164,
            recipientId,
            name: (msg.customerName && !msg.customerName.startsWith('Khách WhatsApp'))
              ? msg.customerName
              : `Khách WhatsApp (${clean.slice(-4)})`,
            firstDate: msgDate,
            lastDate: msgDate,
            businessPhoneNumberId: msg.businessPhoneNumberId || undefined,
            messageIds: [msg.id]
          });
        } else {
          existing.messageIds.push(msg.id);
          if (msg.businessPhoneNumberId && !existing.businessPhoneNumberId) {
            existing.businessPhoneNumberId = msg.businessPhoneNumberId;
          }
          if (msgDate < existing.firstDate) existing.firstDate = msgDate;
          if (msgDate > existing.lastDate) existing.lastDate = msgDate;
          if (msg.customerName && !msg.customerName.startsWith('Khách WhatsApp') && existing.name.startsWith('Khách WhatsApp')) {
            existing.name = msg.customerName;
          }
        }
      }

      for (const group of phoneGroups.values()) {
        const variants = getPhoneLookupVariants(group.phone);
        let customer = await prisma.customer.findFirst({
          where: {
            OR: [
              { whatsappRecipientId: group.recipientId },
              ...(variants.length > 0 ? [{ phone: { in: variants } }] : []),
            ],
          },
        });

        if (!customer) {
          const brandName = await resolveWhatsAppBrandName(group.businessPhoneNumberId);
          customer = await prisma.customer.create({
            data: {
              phone: group.phone,
              whatsappRecipientId: group.recipientId,
              name: group.name,
              source: 'WhatsApp',
              campaign: brandName || 'N/A',
              status: 'New Lead',
              group: 'group_1',
              firstContact: group.firstDate,
              lastContact: group.lastDate,
              ownerId: null,
            }
          });
          syncedCount++;
        }

        await prisma.whatsAppMessage.updateMany({
          where: { id: { in: group.messageIds } },
          data: {
            customerId: customer.id,
            customerName: customer.name,
            recipientId: group.recipientId,
          }
        });
      }

      if (syncedCount > 0) {
        console.log(`[SYNC WHATSAPP TO CRM] Successfully provisioned ${syncedCount} customers from WhatsApp messages.`);
        realtimeHub.broadcast('customers:sync', { source: 'whatsapp-batch-sync' });
      }
    }

    // Reconcile and backfill brand name in campaign for existing WhatsApp customers
    const unbrandedCustomers = await prisma.customer.findMany({
      where: {
        source: 'WhatsApp',
        campaign: { in: ['N/A', 'n/a', 'NA', 'na', '', 'Default Campaign'] }
      },
      select: { id: true, phone: true }
    });

    let brandUpdatedCount = 0;
    for (const cust of unbrandedCustomers) {
      const variants = getPhoneLookupVariants(cust.phone);

      const msgWithPhone = await prisma.whatsAppMessage.findFirst({
        where: {
          businessPhoneNumberId: { not: null },
          OR: [
            { customerId: cust.id },
            ...(variants.length > 0 ? [{ customerPhone: { in: variants } }] : [])
          ]
        },
        select: { businessPhoneNumberId: true },
        orderBy: { timestamp: 'desc' }
      });

      if (msgWithPhone?.businessPhoneNumberId) {
        const brand = await resolveWhatsAppBrandName(msgWithPhone.businessPhoneNumberId);
        if (brand) {
          await prisma.customer.update({
            where: { id: cust.id },
            data: { campaign: brand }
          });
          brandUpdatedCount++;
        }
      }
    }

    if (brandUpdatedCount > 0) {
      console.log(`[SYNC WHATSAPP BRAND] Backfilled brand names for ${brandUpdatedCount} WhatsApp customers.`);
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-brand-reconcile' });
    }

    // Automatically promote any 'New Lead' customers to 'Contacted' if an agent has already replied
    const newLeadCustomers = await prisma.customer.findMany({
      where: { status: 'New Lead' },
      select: { id: true, phone: true }
    });

    let promotedCount = 0;
    for (const lead of newLeadCustomers) {
      const variants = getPhoneLookupVariants(lead.phone);

      const hasAgentReply = await prisma.whatsAppMessage.findFirst({
        where: {
          sender: 'agent',
          OR: [
            { customerId: lead.id },
            ...(variants.length > 0 ? [{ customerPhone: { in: variants } }] : [])
          ]
        },
        select: { id: true, timestamp: true },
        orderBy: { timestamp: 'desc' }
      });

      if (hasAgentReply) {
        await prisma.customer.update({
          where: { id: lead.id },
          data: {
            status: 'Contacted',
            lastContact: hasAgentReply.timestamp
          }
        });
        promotedCount++;
      }
    }

    if (promotedCount > 0) {
      console.log(`[SYNC WHATSAPP STATUS] Automatically promoted ${promotedCount} customers from 'New Lead' to 'Contacted' because replies were already sent.`);
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-status-reconcile' });
    }

    // Reconcile any legacy MessageInternalNote rows into unified CustomerNote
    const legacyInternalNotes = await prisma.messageInternalNote.findMany({
      orderBy: { createdAt: 'asc' },
    }).catch(() => []);

    if (legacyInternalNotes.length > 0) {
      const migratedNoteIds: string[] = [];
      for (const legacyNote of legacyInternalNotes) {
        let customer = await prisma.customer.findUnique({
          where: { id: legacyNote.threadId },
          select: { id: true },
        });
        if (!customer) {
          const variants = getPhoneLookupVariants(legacyNote.threadId);
          if (variants.length > 0) {
            customer = await prisma.customer.findFirst({
              where: { phone: { in: variants } },
              select: { id: true },
            });
          }
        }
        if (customer) {
          await prisma.customerNote.upsert({
            where: { id: legacyNote.id },
            create: {
              id: legacyNote.id,
              customerId: customer.id,
              author: legacyNote.author,
              content: legacyNote.content,
              createdAt: legacyNote.createdAt,
              type: 'note',
            },
            update: {},
          }).catch(() => {});
          migratedNoteIds.push(legacyNote.id);
        }
      }
      if (migratedNoteIds.length > 0) {
        await prisma.messageInternalNote.deleteMany({
          where: { id: { in: migratedNoteIds } },
        }).catch(() => {});
        realtimeHub.broadcast('customers:sync', { source: 'internal-notes-migrated' });
      }
    }

    return syncedCount + promotedCount;
  } catch (err) {
    console.warn('[SYNC WHATSAPP CUSTOMERS ERROR]', err);
    return 0;
  }
}
