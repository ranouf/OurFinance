import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeStoredPreference } from '../../src/app/shared/utils/split-preference';

const active = new Set(['alex', 'camille']);
test('recharge chacun des cinq modes depuis modeJson sans dépendre de memberIds', () => {
  const modes = [
    { kind: 'equal', users: ['alex', 'camille'] },
    { kind: 'exact', amounts: [{ userId: 'alex', amountMinor: 50 }, { userId: 'camille', amountMinor: 51 }] },
    { kind: 'percentage', weightsBasisPoints: [{ userId: 'alex', value: 5000 }, { userId: 'camille', value: 5000 }] },
    { kind: 'shares', weights: [{ userId: 'alex', value: 1 }, { userId: 'camille', value: 1 }] },
    { kind: 'adjustment', adjustments: [{ userId: 'alex', amountMinor: 0 }, { userId: 'camille', amountMinor: 0 }] },
  ];
  for (const mode of modes) assert.deepEqual(decodeStoredPreference(JSON.stringify(mode), active), mode);
});
test('une préférence liée à un membre révoqué ne revient pas', () => {
  const mode = { kind: 'equal', users: ['alex', 'camille'] };
  assert.equal(decodeStoredPreference(JSON.stringify(mode), new Set(['alex'])), undefined);
  assert.equal(decodeStoredPreference('{', active), undefined);
});
