import { strictEqual } from 'node:assert';
import test from 'node:test';
import { accessibleGroupId, groupSelectionStorageKey, selectableGroupIds } from '../../src/app/features/dashboard/group-selection';

test('group selection restores the requested or stored group only when accessible', () => {
  const groups = ['group-a', 'group-b'];
  strictEqual(accessibleGroupId(groups, 'group-b', 'group-a', 'group-a'), 'group-b');
  strictEqual(accessibleGroupId(groups, null, '', 'group-b'), 'group-b');
  strictEqual(accessibleGroupId(groups, 'group-private', '', 'group-b'), 'group-a');
  strictEqual(accessibleGroupId(groups, '%%%bad', '', 'group-b'), 'group-a');
  strictEqual(accessibleGroupId([], 'group-b', '', 'group-b'), '');
});

test('stored group selections are scoped to a single account', () => {
  strictEqual(groupSelectionStorageKey('owner-a') === groupSelectionStorageKey('owner-b'), false);
  strictEqual(accessibleGroupId(['group-b'], null, '', 'group-a'), 'group-b');
});

test('an archived group is never restored as the active group', () => {
  const groups = selectableGroupIds([
    { id: 'closed', status: 'archived' },
    { id: 'open', status: 'active' },
  ]);
  strictEqual(accessibleGroupId(groups, null, 'closed', 'closed'), 'open');
  strictEqual(accessibleGroupId(selectableGroupIds([{ id: 'closed', status: 'archived' }]), null, 'closed', 'closed'), '');
});
