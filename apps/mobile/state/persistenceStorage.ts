import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type PersistenceStorage = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem' | 'removeItem'
>;

const serverStorage: PersistenceStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

export function getPersistenceStorage(
  platform: string,
  isServer: boolean,
): PersistenceStorage {
  return platform === 'web' && isServer ? serverStorage : AsyncStorage;
}

export const persistenceStorage = getPersistenceStorage(
  Platform.OS,
  typeof window === 'undefined',
);
