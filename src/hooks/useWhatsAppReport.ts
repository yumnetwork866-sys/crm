import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/apiClient';
import { queryKeys } from '../lib/queryClient';

export interface WhatsAppReportStats {
  sent: number;
  delivered: number;
  read: number;
  responded: number;
  failed: number;
  inbound: number;
  readRate: number;
  responseRate: number;
  failureRate: number;
  statusDistribution: Array<{ name: string; count: number }>;
  daily: Array<{ date: string; sent: number; received: number }>;
}

export function useWhatsAppReport(startDate = '', endDate = '') {
  const query = useQuery({
    queryKey: queryKeys.whatsappReport(startDate, endDate),
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const qs = params.toString();
      return api.get<WhatsAppReportStats>(`/reports/whatsapp${qs ? `?${qs}` : ''}`);
    },
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
