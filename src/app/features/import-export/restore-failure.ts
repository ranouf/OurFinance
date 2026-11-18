export type RestoreFailureMessage = 'restoreInvalid' | 'restoreUnavailable' | 'restoreUncertain' |
  'restorePreparedUncertain' | 'restoreQuota' | 'restorePreparedQuota' | 'restoreQuotaUncertain';

export async function restoreFailure(response: Response, prepared: boolean, committing = false): Promise<RestoreFailureMessage> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (body?.error === 'provider_quota_exceeded') return prepared ? 'restorePreparedQuota' : committing ? 'restoreQuotaUncertain' : 'restoreQuota';
  if (body?.error === 'recovery_required') return 'restoreUncertain';
  if (prepared) return 'restorePreparedUncertain';
  return response.status === 503 ? 'restoreUnavailable' : 'restoreInvalid';
}
