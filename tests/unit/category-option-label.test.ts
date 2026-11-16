import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { categoryColors, categoryIcons } from '../../src/app/shared/utils/categories';
import { categoryColorLabel, categoryIconLabel } from '../../src/app/shared/utils/category-option-label';

test('all category icon and color options have FR, EN and JA names', () => {
  for (const language of ['fr', 'en', 'ja'] as const) {
    for (const icon of categoryIcons) strictEqual(categoryIconLabel(icon.id, language).length > 0, true);
    for (const color of categoryColors) strictEqual(categoryColorLabel(color.id, language).length > 0, true);
  }
  strictEqual(categoryIconLabel('education', 'ja'), '教育');
  strictEqual(categoryColorLabel('teal', 'en'), 'Teal');
});
