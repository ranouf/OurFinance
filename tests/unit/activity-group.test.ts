import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityGroupForChange } from '../../src/app/features/activity/activity-group';

test('l’activité suit un changement explicite du groupe courant A vers B', () => {
  assert.equal(activityGroupForChange('A', 'B', ['A', 'B'], true), 'B');
});

test('un simple rafraîchissement des groupes conserve la sélection manuelle', () => {
  assert.equal(activityGroupForChange('B', 'A', ['A', 'B'], false), 'B');
});

test('un groupe retiré ne laisse pas apparaître son activité', () => {
  assert.equal(activityGroupForChange('A', 'B', ['B'], false), 'B');
  assert.equal(activityGroupForChange('A', '', [], false), '');
});
