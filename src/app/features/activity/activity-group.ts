export function activityGroupForChange(current: string, preferred: string, groupIds: readonly string[], preferredChanged: boolean): string {
  if (preferredChanged && groupIds.includes(preferred)) return preferred;
  if (groupIds.includes(current)) return current;
  return groupIds.includes(preferred) ? preferred : '';
}
