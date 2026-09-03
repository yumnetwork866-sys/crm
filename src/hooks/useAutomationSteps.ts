import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AutomationStepItem } from '../types';
import { queryKeys } from '../lib/queryClient';
import { api } from '../utils/apiClient';

export function useAutomationSteps() {
  const queryClient = useQueryClient();

  const stepsQuery = useQuery({
    queryKey: queryKeys.automationSteps,
    queryFn: () => api.get<AutomationStepItem[]>('/automation-steps'),
  });

  const saveMutation = useMutation({
    mutationFn: (steps: AutomationStepItem[]) =>
      api.put<AutomationStepItem[]>('/automation-steps', {
        steps: steps.map((step) => ({
          id: step.id,
          step: step.step,
          dayOffset: step.dayOffset,
          title: step.title,
          defaultMsg: step.defaultMsg,
          iconName: step.iconName,
          color: step.color,
          active: step.active,
          templateName: step.templateName,
        })),
      }),
    onSuccess: (savedSteps) => {
      queryClient.setQueryData(queryKeys.automationSteps, savedSteps);
    },
  });

  return {
    steps: stepsQuery.data || [],
    isLoading: stepsQuery.isLoading,
    error: stepsQuery.error,
    saveSteps: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
