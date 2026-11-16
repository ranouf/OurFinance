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
