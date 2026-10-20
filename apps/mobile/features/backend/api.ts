import type {
  ExampleDocumentResponse,
  HealthResponse,
} from '@expo-50sdk-template/shared-types';
import { Platform } from 'react-native';

import { getBackendUrl } from '@/utils/helpers';

export async function getBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${getBackendUrl()}/health`);
  const result = (await response.json()) as HealthResponse;

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return result;
}

export async function createRandomExample(
  accessToken: string,
): Promise<ExampleDocumentResponse> {
  const response = await fetch(`${getBackendUrl()}/api/v1/examples/random`, {
    ...(Platform.OS === 'web'
      ? { credentials: 'include' as const }
      : { headers: { Authorization: `Bearer ${accessToken}` } }),
    method: 'POST',
  });
  const result = (await response.json()) as ExampleDocumentResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      result.message ?? `Backend returned HTTP ${response.status}`,
    );
  }

  return result;
}
