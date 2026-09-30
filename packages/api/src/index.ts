/**
 * @sportshub/api
 * Shared API contracts, HTTP interfaces, and client abstractions
 */

import type { ApiResponse, HealthCheckResponse } from '@sportshub/types';

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface IHealthApiClient {
  getHealth(): Promise<ApiResponse<HealthCheckResponse>>;
}

/**
 * Base abstract client demonstrating API contract architecture
 */
export class BaseApiClient {
  protected readonly baseUrl: string;
  protected readonly timeoutMs: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  protected async get<T>(path: string): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ApiResponse<T>;
  }
}
