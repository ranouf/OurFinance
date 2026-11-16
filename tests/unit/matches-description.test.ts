import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { matchesDescription } from '../../src/app/features/expenses/matches-description';

test('la recherche retrouve les descriptions anciennes sans index, accents ou casse', () => {
  strictEqual(matchesDescription('Épicerie de novembre', 'epicerie'), true);
  strictEqual(matchesDescription('Fournitures scolaires', 'SCOLAIRES'), true);
  strictEqual(matchesDescription('Transport', 'logement'), false);
});
