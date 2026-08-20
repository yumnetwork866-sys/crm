import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppUser,
  BroadcastCampaign,
  CreateWhatsAppTemplateInput,
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
    refetchInterval: (query) => {
      const templates = query.state.data as WhatsAppApprovedTemplate[] | undefined;
      return templates?.some((template) => template.status === 'PENDING') ? 30_000 : false;
    },
  });
  const whatsappTemplates = useMemo(
    () => templatesQuery.data ?? [],
    [templatesQuery.data]
  );
  const approvedTemplates = useMemo(
    () => whatsappTemplates.filter((template) => template.status === 'APPROVED'),
    [whatsappTemplates]
  );

  const createTemplateMutation = useMutation<unknown, Error, CreateWhatsAppTemplateInput>({
    mutationFn: (input) => api.post('/campaigns/templates', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsappTemplates }),
  });

  const createTemplate = useCallback(
    (input: CreateWhatsAppTemplateInput) => createTemplateMutation.mutateAsync(input),
    [createTemplateMutation]
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
    whatsappTemplates,
    approvedTemplates,
    isTemplatesLoading: templatesQuery.isLoading,
    templatesError: templatesQuery.error,
    refetchTemplates: templatesQuery.refetch,
    createTemplate,
    isCreateTemplatePending: createTemplateMutation.isPending,
    createTemplateError: createTemplateMutation.error,
    resetCreateTemplateError: createTemplateMutation.reset,
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
