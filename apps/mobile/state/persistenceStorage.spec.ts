import AsyncStorage from '@react-native-async-storage/async-storage';

import { getPersistenceStorage } from './persistenceStorage';

describe('Redux persistence storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses no-op storage while statically rendering web routes', async () => {
    const storage = getPersistenceStorage('web', true);

    await expect(storage.getItem('key')).resolves.toBeNull();
    await expect(storage.setItem('key', 'value')).resolves.toBeUndefined();
    await expect(storage.removeItem('key')).resolves.toBeUndefined();
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('uses persistent storage in the web client and native apps', () => {
    expect(getPersistenceStorage('web', false)).toBe(AsyncStorage);
    expect(getPersistenceStorage('android', true)).toBe(AsyncStorage);
    expect(getPersistenceStorage('ios', false)).toBe(AsyncStorage);
  });
});
