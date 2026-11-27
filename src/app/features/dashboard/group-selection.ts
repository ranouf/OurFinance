export function groupSelectionStorageKey(userId: string): string { return `ourfinance.group.${userId}`; }

export function accessibleGroupId(groupIds: readonly string[], requested: string | null, current: string, stored: string | null): string {
  const preferred = requested || stored || current;
  return preferred && groupIds.includes(preferred) ? preferred : groupIds[0] ?? '';
}
