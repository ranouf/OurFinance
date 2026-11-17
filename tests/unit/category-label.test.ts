import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { categories } from '../../src/app/shared/utils/categories';
import { categoryLabel } from '../../src/app/shared/utils/category-label';

test('every system category has a label in FR, EN and JA', () => {
  for (const category of categories) {
    for (const language of ['fr', 'en', 'ja'] as const) strictEqual(categoryLabel(category.id, language).length > 0, true);
  }
  strictEqual(categoryLabel('groceries', 'ja'), '食料品');
});

test('custom category names are never translated', () => {
  const id = 'custom_123e4567-e89b-42d3-a456-426614174000';
  for (const language of ['fr', 'en', 'ja'] as const) strictEqual(categoryLabel(id, language, 'Frais de chalet'), 'Frais de chalet');
});
