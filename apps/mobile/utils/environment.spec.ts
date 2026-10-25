import {
  getEnvironmentOrDefault,
  getIsDevelopmentMode,
  getRequiredEnvironment,
} from './environment';

describe('environment helpers', () => {
  it('reads all required Expo values', () => {
    const env = {
      EXPO_PUBLIC_ENV: 'development',
      EXPO_PUBLIC_IP_ADDRESS: '192.168.1.5',
      EXPO_PUBLIC_PORT_NUMBER: '4200',
    } as NodeJS.ProcessEnv;

    expect(getRequiredEnvironment(env)).toEqual({
      env: 'development',
      ipAddress: '192.168.1.5',
      portNumber: '4200',
    });
    expect(getIsDevelopmentMode(env)).toBe(true);
  });

  it('uses process values when no environment object is passed', () => {
    const previousValues = {
      env: process.env.EXPO_PUBLIC_ENV,
      ipAddress: process.env.EXPO_PUBLIC_IP_ADDRESS,
      portNumber: process.env.EXPO_PUBLIC_PORT_NUMBER,
    };
    process.env.EXPO_PUBLIC_ENV = 'production';
    process.env.EXPO_PUBLIC_IP_ADDRESS = '192.168.1.5';
    process.env.EXPO_PUBLIC_PORT_NUMBER = '4200';

    try {
      expect(getRequiredEnvironment()).toEqual({
        env: 'production',
        ipAddress: '192.168.1.5',
        portNumber: '4200',
      });
      expect(getIsDevelopmentMode()).toBe(false);
    } finally {
      if (previousValues.env === undefined) {
        delete process.env.EXPO_PUBLIC_ENV;
      } else {
        process.env.EXPO_PUBLIC_ENV = previousValues.env;
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

  it('reports missing required values', () => {
    expect(() => getRequiredEnvironment({})).toThrow(
      'Missing required Expo env values',
    );
  });

  it('falls back to local development defaults', () => {
    expect(getEnvironmentOrDefault({})).toEqual({
      env: 'development',
      ipAddress: '127.0.0.1',
      portNumber: '4200',
    });
  });

  it('fails fast for incomplete non-development configuration', () => {
    expect(() =>
      getEnvironmentOrDefault({ EXPO_PUBLIC_ENV: 'production' }),
    ).toThrow('Missing required Expo env values');
  });

  it('uses supplied development values when the configuration is incomplete', () => {
    expect(
      getEnvironmentOrDefault({
        EXPO_PUBLIC_ENV: 'development',
        EXPO_PUBLIC_IP_ADDRESS: '192.168.1.10',
      }),
    ).toEqual({
      env: 'development',
      ipAddress: '192.168.1.10',
      portNumber: '4200',
    });
  });
});
