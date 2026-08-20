import type { BroadcastCampaign, Customer } from '../types';
import { formatDateTime } from './crmUtils';

export const mapApiCustomerToFrontend = (apiCustomer: any): Customer => {
  const logs = apiCustomer.automationLogs || [];
  const currentStep = logs.length > 0 ? Math.max(...logs.map((log: any) => log.step)) : 0;

  return {
    ...apiCustomer,
    firstContact: apiCustomer.firstContact
      ? new Date(apiCustomer.firstContact).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    lastContact: apiCustomer.lastContact
      ? new Date(apiCustomer.lastContact).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    whatsappOptInDate: apiCustomer.whatsappOptInDate
      ? new Date(apiCustomer.whatsappOptInDate).toISOString().split('T')[0]
      : undefined,
    lastPurchaseDate: apiCustomer.lastPurchaseDate
      ? new Date(apiCustomer.lastPurchaseDate).toISOString().split('T')[0]
      : undefined,
    notes: (apiCustomer.notes || []).map((note: any) => ({
      ...note,
      createdAt: note.createdAt ? formatDateTime(note.createdAt) : '',
    })),
    orders: (apiCustomer.orders || []).map((order: any) => ({
      ...order,
      date: order.date ? new Date(order.date).toISOString().split('T')[0] : '',
      products: order.products || [],
    })),
    automationSequence: {
      active: apiCustomer.totalOrders > 0,
      currentStep,
      startDate: apiCustomer.lastPurchaseDate
        ? new Date(apiCustomer.lastPurchaseDate).toISOString().split('T')[0]
        : undefined,
      logs: logs.map((log: any) => ({
        step: log.step,
        stepName: log.stepName,
        sentAt: log.sentAt ? formatDateTime(log.sentAt) : '',
        message: log.message,
        status: log.status,
      })),
    },
  };
};

export const mapApiCampaignToFrontend = (apiCampaign: any): BroadcastCampaign => ({
  ...apiCampaign,
  createdAt: apiCampaign.createdAt
    ? new Date(apiCampaign.createdAt).toISOString()
    : '',
  stats: apiCampaign.stats || {
    totalTargeted: apiCampaign.totalTargeted ?? 0,
    optedInCount: apiCampaign.optedInCount ?? 0,
    sentCount: apiCampaign.sentCount ?? 0,
    deliveredCount: apiCampaign.deliveredCount ?? 0,
    readCount: apiCampaign.readCount ?? 0,
    respondedCount: apiCampaign.respondedCount ?? 0,
    failedCount: apiCampaign.failedCount ?? 0,
  },
});
