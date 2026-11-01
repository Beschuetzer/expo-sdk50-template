global.alert = jest.fn();

const resetExpoEnv = () => {
  const nextEnv = { ...process.env };
  for (const key of [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_ENV',
    'EXPO_PUBLIC_IDP_URL',
    'EXPO_PUBLIC_IP_ADDRESS',
    'EXPO_PUBLIC_PORT_NUMBER',
  ]) {
    delete nextEnv[key];
  }

  Object.defineProperty(process, 'env', {
    value: nextEnv,
    configurable: true,
    writable: true,
  });
};

resetExpoEnv();

if (typeof global.fetch !== 'function') {
  global.fetch = jest.fn();
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn(() => jest.fn()),
}));
