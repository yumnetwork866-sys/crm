import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INITIAL_CAMPAIGNS } from '../data/mockData';
import type { AppUser, BroadcastCampaign } from '../types';
import { queryKeys } from '../lib/queryClient';
import { api } from '../utils/apiClient';
import { mapApiCampaignToFrontend } from '../utils/apiMappers';

const STORAGE_KEY_CAMPAIGNS = 'yumcrm_campaigns_v2';

const loadCampaigns = (): BroadcastCampaign[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
    return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
  } catch {
    return INITIAL_CAMPAIGNS;
  }
};

export function useCampaigns(currentUser: AppUser | null) {
  const queryClient = useQueryClient();
  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns,
    queryFn: async () => {
      const response = await api.get<any[]>('/campaigns');
      return response.map(mapApiCampaignToFrontend);
    },
    enabled: Boolean(currentUser),
    initialData: loadCampaigns,
    initialDataUpdatedAt: 0,
  });
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(campaigns));
    } catch (error) {
      console.error('Error saving campaigns to localStorage', error);
    }
  }, [campaigns]);

  const launchMutation = useMutation({
    mutationFn: (campaign: BroadcastCampaign) => api.post<any>('/campaigns', campaign),
    onMutate: async (campaign) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.campaigns });
      const previous = queryClient.getQueryData<BroadcastCampaign[]>(queryKeys.campaigns) || [];
      queryClient.setQueryData<BroadcastCampaign[]>(queryKeys.campaigns, [campaign, ...previous]);
      return { previous, optimisticId: campaign.id };
    },
    onError: (_error, _campaign, context) => {
      if (context) queryClient.setQueryData(queryKeys.campaigns, context.previous);
    },
    onSuccess: (saved, _campaign, context) => {
      const mapped = mapApiCampaignToFrontend(saved);
      queryClient.setQueryData<BroadcastCampaign[]>(queryKeys.campaigns, (current = []) =>
        current.map((campaign) => campaign.id === context?.optimisticId ? mapped : campaign)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });

  const launchCampaign = useCallback((campaign: BroadcastCampaign) => {
    launchMutation.mutate(campaign);
  }, [launchMutation]);

  const resetCampaigns = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_CAMPAIGNS);
    queryClient.setQueryData(queryKeys.campaigns, INITIAL_CAMPAIGNS);
  }, [queryClient]);

  return {
    campaigns,
    launchCampaign,
    resetCampaigns,
    isLoading: campaignsQuery.isLoading,
    isFetching: campaignsQuery.isFetching,
    isError: campaignsQuery.isError || launchMutation.isError,
    error: campaignsQuery.error || launchMutation.error,
    isMutating: launchMutation.isPending,
  };
}
