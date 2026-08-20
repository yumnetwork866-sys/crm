import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppUser,
  BroadcastCampaign,
  LaunchCampaignInput,
  WhatsAppApprovedTemplate,
} from '../types';
import { queryKeys } from '../lib/queryClient';
import { api } from '../utils/apiClient';
import { mapApiCampaignToFrontend } from '../utils/apiMappers';

export function useCampaigns(currentUser: AppUser | null) {
  const queryClient = useQueryClient();
  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns,
    queryFn: async () => {
      const response = await api.get<any[]>('/campaigns');
      return response.map(mapApiCampaignToFrontend);
    },
    enabled: Boolean(currentUser),
    refetchInterval: (query) => {
      const campaigns = query.state.data as BroadcastCampaign[] | undefined;
      return campaigns?.some((campaign) =>
        ['Pending', 'Sending'].includes(campaign.status)
      )
        ? 5_000
        : false;
    },
  });
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);

  const templatesQuery = useQuery({
    queryKey: queryKeys.whatsappTemplates,
    queryFn: () => api.get<WhatsAppApprovedTemplate[]>('/campaigns/templates'),
    enabled: Boolean(currentUser),
    staleTime: 60_000,
    retry: false,
  });
  const approvedTemplates = useMemo(
    () => templatesQuery.data ?? [],
    [templatesQuery.data]
  );

  const launchMutation = useMutation<BroadcastCampaign, Error, LaunchCampaignInput>({
    mutationFn: async (input) => {
      const saved = await api.post<any>('/campaigns/launch', input);
      return mapApiCampaignToFrontend(saved);
    },
    onSuccess: (campaign) => {
      queryClient.setQueryData<BroadcastCampaign[]>(queryKeys.campaigns, (current = []) => [
        campaign,
        ...current.filter((item) => item.id !== campaign.id),
      ]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });

  const launchCampaign = useCallback(
    (input: LaunchCampaignInput) => launchMutation.mutateAsync(input),
    [launchMutation]
  );

  const resetCampaigns = useCallback(() => {
    queryClient.setQueryData(queryKeys.campaigns, []);
  }, [queryClient]);

  return {
    campaigns,
    approvedTemplates,
    isTemplatesLoading: templatesQuery.isLoading,
    templatesError: templatesQuery.error,
    refetchTemplates: templatesQuery.refetch,
    launchCampaign,
    resetCampaigns,
    isLoading: campaignsQuery.isLoading,
    isFetching: campaignsQuery.isFetching,
    isError: campaignsQuery.isError,
    error: campaignsQuery.error,
    isLaunchPending: launchMutation.isPending,
    launchError: launchMutation.error,
    resetLaunchError: launchMutation.reset,
  };
}
