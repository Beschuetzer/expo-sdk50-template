import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { reportDiagnostic } from '@/utils/diagnostics';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      networkMode: 'offlineFirst',
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      staleTime: 1000 * 60,
    },
  },
});

const baseQueryPersister = createAsyncStoragePersister({
  key: '@mobile/query-cache',
  storage: {
    ...AsyncStorage,
    setItem: async (...args: Parameters<typeof AsyncStorage.setItem>) => {
      try {
        return await AsyncStorage.setItem(...args);
      } catch (error) {
        reportDiagnostic(error, {
          operation: 'setItem',
          source: 'queryPersister',
        });
        throw error;
      }
    },
  },
  throttleTime: 1000,
});

export const queryPersister = {
  ...baseQueryPersister,
  persistClient: async (
    client: Parameters<typeof baseQueryPersister.persistClient>[0],
  ) => {
    try {
      return await baseQueryPersister.persistClient(client);
    } catch (error) {
      reportDiagnostic(error, {
        operation: 'persistClient',
        source: 'queryPersister',
      });
      throw error;
    }
  },
  removeClient: async () => {
    try {
      return await baseQueryPersister.removeClient();
    } catch (error) {
      reportDiagnostic(error, {
        operation: 'removeClient',
        source: 'queryPersister',
      });
      throw error;
    }
  },
  restoreClient: async () => {
    try {
      return await baseQueryPersister.restoreClient();
    } catch (error) {
      reportDiagnostic(error, {
        operation: 'restoreClient',
        source: 'queryPersister',
      });
      throw error;
    }
  },
};

export const queryPersistOptions = {
  buster: 'mobile-query-cache-v1',
  maxAge: 1000 * 60 * 60 * 24,
  persister: queryPersister,
};

export async function clearPersistedQueryCache() {
  queryClient.clear();
  await queryPersister.removeClient();
}
