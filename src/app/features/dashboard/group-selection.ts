import type { Group } from '../../core/firebase/group-model';

export function selectableGroupIds(groups: readonly Pick<Group, 'id' | 'status'>[]): string[] {
  return groups.filter(group => group.status === 'active').map(group => group.id);
}

export function groupSelectionStorageKey(userId: string): string { return `ourfinance.group.${userId}`; }

export function accessibleGroupId(groupIds: readonly string[], requested: string | null, current: string, stored: string | null): string {
  const preferred = requested || stored || current;
  return preferred && groupIds.includes(preferred) ? preferred : groupIds[0] ?? '';
}
