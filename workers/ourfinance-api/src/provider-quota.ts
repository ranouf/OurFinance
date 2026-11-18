/** Fixed public quota signal; upstream response bodies can contain private details. */
export class ProviderQuotaError extends Error {
  constructor() { super('provider_quota_exceeded'); }
}

export function isProviderQuotaStatus(status: number): boolean {
  return status === 420 || status === 429;
}

export function unavailableCode(response: Response, fallback: string): string {
  return isProviderQuotaStatus(response.status) ? 'provider_quota_exceeded' : fallback;
}
