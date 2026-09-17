import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppUser, MarketingCampaignReport } from '../types';
import { api } from '../utils/apiClient';
import { queryKeys } from '../lib/queryClient';
import { INITIAL_MARKETING_REPORTS } from '../data/mockData';

export function useMarketingReports(currentUser: AppUser | null) {
  const queryClient = useQueryClient();

  const reportsQuery = useQuery<MarketingCampaignReport[]>({
    queryKey: queryKeys.marketingReports,
    queryFn: async () => {
      try {
        const data = await api.get<MarketingCampaignReport[]>('/reports/marketing');
        return Array.isArray(data) && data.length > 0 ? data : INITIAL_MARKETING_REPORTS;
      } catch (err) {
        console.warn('[Marketing Reports] Failed to fetch reports, using fallback:', err);
        return INITIAL_MARKETING_REPORTS;
      }
    },
    enabled: Boolean(currentUser),
    staleTime: 60_000,
  });

  const saveReportsMutation = useMutation({
    mutationFn: async (reports: MarketingCampaignReport[]) => {
      // Create/update each report on the backend
      for (const report of reports) {
        if (report.id) {
          await api.put(`/reports/marketing/${report.id}`, report);
        } else {
          await api.post('/reports/marketing', report);
        }
      }
      return reports;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.marketingReports });
    },
  });

  return {
    marketingReports: reportsQuery.data || INITIAL_MARKETING_REPORTS,
    isLoading: reportsQuery.isLoading,
    isError: reportsQuery.isError,
    saveReports: saveReportsMutation.mutate,
    refetch: reportsQuery.refetch,
  };
}
