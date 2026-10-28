import { getBackendUrl } from './platform';

describe('getBackendUrl', () => {
  it('uses the configured development API port', () => {
    const previousValues = {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      environment: process.env.EXPO_PUBLIC_ENV,
      ipAddress: process.env.EXPO_PUBLIC_IP_ADDRESS,
      portNumber: process.env.EXPO_PUBLIC_PORT_NUMBER,
    };

    delete process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_ENV = 'development';
    process.env.EXPO_PUBLIC_IP_ADDRESS = '127.0.0.1';
    process.env.EXPO_PUBLIC_PORT_NUMBER = '4300';

    try {
      expect(getBackendUrl()).toBe('http://127.0.0.1:4300');
    } finally {
      if (previousValues.apiUrl === undefined) {
        delete process.env.EXPO_PUBLIC_API_URL;
      } else {
        process.env.EXPO_PUBLIC_API_URL = previousValues.apiUrl;
      }
      if (previousValues.environment === undefined) {
        delete process.env.EXPO_PUBLIC_ENV;
      } else {
        process.env.EXPO_PUBLIC_ENV = previousValues.environment;
      }
      if (previousValues.ipAddress === undefined) {
        delete process.env.EXPO_PUBLIC_IP_ADDRESS;
      } else {
        process.env.EXPO_PUBLIC_IP_ADDRESS = previousValues.ipAddress;
      }
      if (previousValues.portNumber === undefined) {
        delete process.env.EXPO_PUBLIC_PORT_NUMBER;
      } else {
        process.env.EXPO_PUBLIC_PORT_NUMBER = previousValues.portNumber;
      }
    }
  });
});
