import { SplitMode } from './split-engine';

export interface SplitPreference {
  readonly userId: string;
  readonly groupId: string;
  readonly mode: SplitMode;
  readonly memberIds: readonly string[];
}

/** Returns no preference for first use or changed membership; never silently changes history. */
export function applicablePreference(preference: SplitPreference | undefined, userId: string, groupId: string, activeMembers: ReadonlySet<string>): SplitMode | undefined {
  if (!preference || preference.userId !== userId || preference.groupId !== groupId ||
      preference.memberIds.some(id => !activeMembers.has(id))) return undefined;
  return preference.mode;
}

/** Read the mode itself as the source of selected members; older documents may lack memberIds. */
export function decodeStoredPreference(modeJson: unknown, activeMembers: ReadonlySet<string>): SplitMode | undefined {
  if (typeof modeJson !== 'string') return undefined;
  let value: unknown;
  try { value = JSON.parse(modeJson); } catch { return undefined; }
  if (!value || typeof value !== 'object') return undefined;
  const mode = value as Record<string, unknown>;
  let entries: unknown;
  switch (mode['kind']) {
    case 'equal': entries = mode['users']; break;
    case 'exact': entries = mode['amounts']; break;
    case 'percentage': entries = mode['weightsBasisPoints']; break;
    case 'shares': entries = mode['weights']; break;
    case 'adjustment': entries = mode['adjustments']; break;
    default: return undefined;
  }
  if (!Array.isArray(entries) || !entries.length) return undefined;
  const ids = entries.map(entry => mode['kind'] === 'equal' ? entry : entry?.userId);
  if (ids.some(id => typeof id !== 'string' || !activeMembers.has(id)) || new Set(ids).size !== ids.length) return undefined;
  return value as SplitMode;
}
