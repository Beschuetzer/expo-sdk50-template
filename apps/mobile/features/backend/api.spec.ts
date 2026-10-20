import { Platform } from 'react-native';

import { createRandomExample, getBackendHealth } from './api';

jest.mock('@/utils/helpers', () => ({
  getBackendUrl: jest.fn(() => 'http://localhost:4200'),
}));

function makeResponse(body: unknown, status: number): Response {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

describe('backend API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the health response', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ status: 'ok', service: 'api' }, 200));

    await expect(getBackendHealth()).resolves.toEqual({
      service: 'api',
      status: 'ok',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4200/health');
  });

  it('throws when the backend returns an error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ status: 'error' }, 503));

    await expect(getBackendHealth()).rejects.toThrow('HTTP 503');
  });

  it('creates a random example with platform-appropriate authentication', async () => {
    const example = {
      id: 'example-123',
      name: 'Morgan Ellis',
      email: 'example-123@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse(example, 201));

    await expect(createRandomExample('access-token')).resolves.toEqual(example);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4200/api/v1/examples/random',
      {
        ...(Platform.OS === 'web'
          ? { credentials: 'include' }
          : { headers: { Authorization: 'Bearer access-token' } }),
        method: 'POST',
      },
    );
  });

  it('throws when creating an example fails', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeResponse({ message: 'Forbidden.' }, 403));

    await expect(createRandomExample('access-token')).rejects.toThrow(
      'Forbidden.',
    );
  });
});
