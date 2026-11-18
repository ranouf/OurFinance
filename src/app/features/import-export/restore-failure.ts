export type RestoreFailureMessage = 'restoreInvalid' | 'restoreUnavailable' | 'restoreUncertain' |
  'restorePreparedUncertain' | 'restoreQuota' | 'restorePreparedQuota';

export async function restoreFailure(response: Response, prepared: boolean): Promise<RestoreFailureMessage> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (body?.error === 'provider_quota_exceeded') return prepared ? 'restorePreparedQuota' : 'restoreQuota';
  if (body?.error === 'recovery_required') return 'restoreUncertain';
  if (prepared) return 'restorePreparedUncertain';
  return response.status === 503 ? 'restoreUnavailable' : 'restoreInvalid';
}
