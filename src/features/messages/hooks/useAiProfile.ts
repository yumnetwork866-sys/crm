import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryClient';
import { api } from '../../../utils/apiClient';
import { realtimeClient } from '../../../services/realtimeClient';

export interface AiProfile {
  name: string;
  avatarUrl: string | null;
}

export function useAiProfile() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.aiProfile,
    queryFn: () => api.get<AiProfile>('/ai-profile'),
    staleTime: Infinity,
  });

  useEffect(() => realtimeClient.subscribe({
    'ai:profile': (event) => {
      try {
        queryClient.setQueryData<AiProfile>(queryKeys.aiProfile, JSON.parse(event.data));
      } catch {
        // Ignore malformed realtime events.
      }
    },
  }), [queryClient]);

  return query;
}
