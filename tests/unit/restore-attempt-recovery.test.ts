import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RestoreAttemptStore } from '../../src/app/features/import-export/restore-attempt-store';

const restoreId = '17fe9010-7f58-4525-a5a8-24f3f9c95f37';

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

test('une tentative persistée reste liée au propriétaire et au groupe', () => {
  const store = new RestoreAttemptStore(new MemoryStorage());
  store.remember('owner', 'group', restoreId);
  assert.deepEqual(store.find('owner', ['group']), { groupId: 'group', restoreId });
  assert.equal(store.find('other', ['group']), undefined);
  store.forget('owner', 'group', '00000000-0000-4000-8000-000000000000');
  assert.equal(store.find('owner', ['group'])?.restoreId, restoreId);
  store.forget('owner', 'group', restoreId);
  assert.equal(store.find('owner', ['group']), undefined);
});
