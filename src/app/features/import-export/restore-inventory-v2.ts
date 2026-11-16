import { serializeGroupExportV2, type GroupExportV2 } from './export-v2';

export interface RestoreInventoryV2 {
  readonly groupDocuments: readonly string[];
  readonly userDocuments: readonly string[];
  readonly receiptDocuments: readonly string[];
  readonly absentPreferenceDocuments: readonly string[];
}

export interface RestoreDiffV2 {
  readonly replaceGroupDocuments: readonly string[];
  readonly replaceUserDocuments: readonly string[];
  readonly deleteGroupDocuments: readonly string[];
  readonly deleteUserDocuments: readonly string[];
}

/** Complete path inventory for comparing live documents before any destructive write. */
export function restoreInventoryV2(value: GroupExportV2): RestoreInventoryV2 {
  const backup = JSON.parse(serializeGroupExportV2(value)) as GroupExportV2;
  const root = `groups/${backup.group.id}`;
  const receiptDocuments = backup.receipts.map(row => `${root}/expenses/${row.expenseId}/attachments/${row.attachmentId}`);
  const groupDocuments = [
    root,
    ...backup.members.map(row => `${root}/members/${row.userId}`),
    ...backup.categories.map(row => `${root}/categories/${row.id}`),
    ...backup.expenses.map(row => `${root}/expenses/${row.id}`),
    ...backup.comments.map(row => `${root}/expenses/${row.expenseId}/comments/${row.id}`),
    ...receiptDocuments,
    ...backup.settlements.map(row => `${root}/settlements/${row.id}`),
    ...backup.importedRecords.map(row => `${root}/importedRecords/${row.id}`),
    ...backup.activity.map(row => `${root}/activity/${row.id}`),
  ];
  const userDocuments = [
    ...backup.members.map(row => `users/${row.userId}/groupMemberships/${backup.group.id}`),
    ...backup.preferences.map(row => `users/${row.userId}/groupPreferences/${backup.group.id}`),
    ...backup.importBatches.map(row => `users/${row.ownerId}/importBatches/${row.id}`),
  ];
  if (new Set(groupDocuments).size !== groupDocuments.length || new Set(userDocuments).size !== userDocuments.length) {
    throw new Error('Chemins de restauration ambigus');
  }
  const absentPreferenceDocuments = backup.preferences.filter(row => row.modeJson === null)
    .map(row => `users/${row.userId}/groupPreferences/${backup.group.id}`);
  return { groupDocuments, userDocuments, receiptDocuments, absentPreferenceDocuments };
}

/** A dry-run only: the caller must supply a complete, authorized live inventory. */
export function compareRestoreInventoryV2(value: GroupExportV2, liveGroupDocuments: readonly string[], liveUserDocuments: readonly string[]): RestoreDiffV2 {
  const inventory = restoreInventoryV2(value);
  const groupId = value.group.id;
  const groupRoot = `groups/${groupId}`;
  const members = new Set(value.members.map(row => row.userId));
  const allowedCollections = new Set(['members', 'categories', 'expenses', 'settlements', 'importedRecords', 'activity', 'balances', 'statistics', 'invitations']);
  const validId = (part: string) => /^[A-Za-z0-9_-]{1,128}$/.test(part);
  const validGroupPath = (path: string): boolean => {
    if (path === groupRoot) return true;
    if (!path.startsWith(`${groupRoot}/`)) return false;
    const parts = path.slice(groupRoot.length + 1).split('/');
    return (parts.length === 2 && allowedCollections.has(parts[0]) && validId(parts[1])) ||
      (parts.length === 4 && parts[0] === 'expenses' && validId(parts[1]) && (parts[2] === 'comments' || parts[2] === 'attachments') && validId(parts[3]));
  };
  const validUserPath = (path: string): boolean => {
    const parts = path.split('/');
    return parts.length === 4 && parts[0] === 'users' && members.has(parts[1]) &&
      ((parts[2] === 'groupMemberships' || parts[2] === 'groupPreferences') && parts[3] === groupId ||
        parts[2] === 'importBatches' && validId(parts[3]));
  };
  if (new Set(liveGroupDocuments).size !== liveGroupDocuments.length || new Set(liveUserDocuments).size !== liveUserDocuments.length ||
      liveGroupDocuments.some(path => !validGroupPath(path)) || liveUserDocuments.some(path => !validUserPath(path))) {
    throw new Error('Inventaire actuel incomplet ou ambigu');
  }
  const groupTarget = new Set(inventory.groupDocuments);
  const userTarget = new Set(inventory.userDocuments.filter(path => !inventory.absentPreferenceDocuments.includes(path)));
  return {
    replaceGroupDocuments: inventory.groupDocuments,
    replaceUserDocuments: [...userTarget],
    deleteGroupDocuments: liveGroupDocuments.filter(path => path !== groupRoot && !groupTarget.has(path)),
    deleteUserDocuments: [...new Set([...liveUserDocuments.filter(path => !userTarget.has(path)),
      ...inventory.absentPreferenceDocuments.filter(path => liveUserDocuments.includes(path))])],
  };
}
