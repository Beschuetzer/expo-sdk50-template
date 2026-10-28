import { logWhenDevelopmentMode } from './logging';
import {
  delay,
  displayAlert,
  getBackendUrl,
  getIdentityProviderUrl,
  measureExecutionTime,
  wait,
} from './platform';

jest.mock('./logging', () => ({
  logWhenDevelopmentMode: jest.fn(),
}));

const mockedLogWhenDevelopmentMode = jest.mocked(logWhenDevelopmentMode);
const environmentVariables = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_ENV',
  'EXPO_PUBLIC_IDP_URL',
  'EXPO_PUBLIC_IP_ADDRESS',
  'EXPO_PUBLIC_PORT_NUMBER',
] as const;

describe('platform utilities', () => {
  const previousEnvironment = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of environmentVariables) {
      previousEnvironment.set(key, process.env[key]);
      delete process.env[key];
    }

    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const key of environmentVariables) {
      const value = previousEnvironment.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    jest.useRealTimers();
  });

  describe('displayAlert', () => {
    it('logs objects as formatted JSON', () => {
      displayAlert({ status: 'ready', count: 1 });

      expect(mockedLogWhenDevelopmentMode).toHaveBeenCalledWith(
        '{\n  "status": "ready",\n  "count": 1\n}',
      );
    });

    it('logs a fallback message for null', () => {
      displayAlert(null);

      expect(mockedLogWhenDevelopmentMode).toHaveBeenCalledWith(
        'displayAlert called',
      );
    });
  });

  describe('getBackendUrl', () => {
    it('uses configured development host and port', () => {
      process.env.EXPO_PUBLIC_ENV = 'development';
      process.env.EXPO_PUBLIC_IP_ADDRESS = '127.0.0.1';
      process.env.EXPO_PUBLIC_PORT_NUMBER = '4300';

      expect(getBackendUrl()).toBe('http://127.0.0.1:4300');
    });

    it('uses local defaults when development configuration is missing', () => {
      expect(getBackendUrl()).toBe('http://127.0.0.1:4200');
    });

    it('uses the production fallback outside development', () => {
      process.env.EXPO_PUBLIC_ENV = 'production';
      process.env.EXPO_PUBLIC_IP_ADDRESS = '192.168.1.5';
      process.env.EXPO_PUBLIC_PORT_NUMBER = '4300';

      expect(getBackendUrl()).toBe(
        'https://your-production-api.example.com',
      );
    });
  });

  describe('getIdentityProviderUrl', () => {
    it('throws an actionable error when the URL is missing', () => {
      expect(() => getIdentityProviderUrl()).toThrow(
        'EXPO_PUBLIC_IDP_URL is not configured.',
      );
    });
  });

  describe('measureExecutionTime', () => {
    it('awaits the task and logs its execution time by default', async () => {
      let completed = false;
      const task = jest.fn(async () => {
        await Promise.resolve();
        completed = true;
      });

      await measureExecutionTime(task);

      expect(task).toHaveBeenCalledTimes(1);
      expect(completed).toBe(true);
      expect(mockedLogWhenDevelopmentMode).toHaveBeenCalledWith({
        executionTimeOfFunc: expect.any(Number),
      });
    });

    it('runs the task without logging when logging is disabled', async () => {
      const task = jest.fn(async () => undefined);

      await measureExecutionTime(task, 'cleanup', false);

      expect(task).toHaveBeenCalledTimes(1);
      expect(mockedLogWhenDevelopmentMode).not.toHaveBeenCalled();
    });
  });

  describe('wait', () => {
    it('returns undefined for nonpositive durations', () => {
      expect(wait(0)).toBeUndefined();
      expect(wait(-1)).toBeUndefined();
    });

    it('resolves after the requested timeout', async () => {
      jest.useFakeTimers();
      const result = wait(25);

      jest.advanceTimersByTime(25);

      await expect(result).resolves.toBeNull();
    });
  });

  describe('delay', () => {
    it('resolves without a timer for nonpositive durations', async () => {
      await expect(delay(0)).resolves.toBeUndefined();
      await expect(delay(-1)).resolves.toBeUndefined();
    });

    it('resolves after the requested timeout', async () => {
      jest.useFakeTimers();
      const result = delay(25);

      jest.advanceTimersByTime(25);

      await expect(result).resolves.toBeNull();
    });
  });
});
