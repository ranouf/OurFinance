import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyDropdownOptions, groupDropdownOptions } from '../../src/app/shared/components/dropdown/dropdown-options';
import { categoryDropdownOptions } from '../../src/app/shared/utils/category-dropdown-options';

test('group choices preserve identifiers, translated fallback and distinct names', () => {
  const choices = groupDropdownOptions([
    { id: 'group-a', name: 'Voyage', currency: 'CAD' },
    { id: 'group-b', name: 'Voyage', currency: 'JPY' },
  ], 'Tous', true);
  assert.deepEqual(choices.map(choice => choice.value), ['', 'group-a', 'group-b']);
  assert.deepEqual(choices.map(choice => choice.label), ['Tous', 'Voyage · CAD', 'Voyage · JPY']);
});

test('currency choices use a known flag and never invent one for an unknown code', () => {
  const choices = currencyDropdownOptions([
    { code: 'CAD', name: 'Dollar canadien', symbol: '$', minorDigits: 2 },
    { code: 'AED', name: 'Dirham', symbol: 'د.إ', minorDigits: 2 },
    { code: 'AFN', name: 'Afghani', symbol: '؋', minorDigits: 2 },
    { code: 'XTS', name: 'Code de test', symbol: 'XTS', minorDigits: 2 },
  ]);
  assert.equal(choices[0].iconSrc, '/flags/ca.svg');
  assert.equal(choices[1].iconSrc, '/flags/ae.svg');
  assert.equal(choices[2].iconSrc, '/flags/af.svg');
  assert.equal(choices[3].iconSrc, undefined);
});

test('category choices keep a recognizable icon or the original glyph', () => {
  const choices = categoryDropdownOptions([
    { id: 'restaurant', label: 'Restaurant', icon: '🍽️', color: 'amber' },
    { id: 'education', label: 'École', icon: '🎓', color: 'violet' },
    { id: 'custom_other', label: 'Spécial', icon: '⭐', color: 'violet' },
  ], category => category.label);
  assert.equal(choices[0].iconName, 'utensils');
  assert.equal(choices[1].iconName, 'graduation-cap');
  assert.equal(choices[2].label, '⭐ Spécial');
});
