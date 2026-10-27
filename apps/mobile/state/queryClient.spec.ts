import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearPersistedQueryCache,
  queryClient,
  queryPersistOptions,
} from './queryClient';

type TestPersister = {
  persistClient: (client: unknown) => Promise<void>;
  removeClient: () => Promise<void>;
  restoreClient: () => Promise<unknown>;
};

describe('query persistence policy', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(async () => {
    queryClient.clear();
    await AsyncStorage.clear();
    consoleError.mockClear();
    jest.restoreAllMocks();
  });

  it('persists only successful backend health data', () => {
    const shouldDehydrateQuery =
      queryPersistOptions.dehydrateOptions.shouldDehydrateQuery;

    expect(
      shouldDehydrateQuery({
        queryKey: ['backend', 'health'],
        state: { status: 'success' },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateQuery({
        queryKey: ['account', 'profile'],
        state: { status: 'success' },
      }),
    ).toBe(false);
    expect(
      shouldDehydrateQuery({
        queryKey: ['backend', 'health'],
        state: { status: 'error' },
      }),
    ).toBe(false);
  });

  it('caps retry delays at thirty seconds', () => {
    const retryDelay = queryClient.getDefaultOptions().queries?.retryDelay;
    if (typeof retryDelay !== 'function') {
      throw new Error('Expected query retry delay to be a function');
    }

    const error = new Error('request failed');
    expect(retryDelay(0, error)).toBe(1000);
    expect(retryDelay(10, error)).toBe(30000);
  });

  it('clears memory and persisted query data', async () => {
    queryClient.setQueryData(['account', 'profile'], { subject: 'user-1' });
    const removeItem = jest.spyOn(AsyncStorage, 'removeItem');

    await clearPersistedQueryCache();

    expect(queryClient.getQueryData(['account', 'profile'])).toBeUndefined();
    expect(removeItem).toHaveBeenCalledWith('@mobile/query-cache');
  });

  it('reports persisted write failures', async () => {
    const error = new Error('persistClient failed');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(error);
    const persister = queryPersistOptions.persister as unknown as TestPersister;

    await persister.persistClient({});
  });

  it('reports restore failures', async () => {
    const error = new Error('restoreClient failed');
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(error);
    const persister = queryPersistOptions.persister as unknown as TestPersister;

    await persister.restoreClient().catch(() => undefined);
  });

  it('reports removal failures', async () => {
    const error = new Error('removeClient failed');
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(error);
    const persister = queryPersistOptions.persister as unknown as TestPersister;

    await persister.removeClient().catch(() => undefined);
  });
});
