import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  customers: ['customers'] as const,
  products: ['products'] as const,
  campaigns: ['campaigns'] as const,
  whatsappTemplates: ['whatsapp-templates'] as const,
  centralMessages: ['central-messages'] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
