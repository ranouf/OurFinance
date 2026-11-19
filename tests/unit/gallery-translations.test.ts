import assert from 'node:assert/strict';
import test from 'node:test';
import { galleryTranslations } from '../../src/app/gallery/gallery/gallery-translations';

test('the component gallery and validation errors have the same keys in FR, EN and JA', () => {
  const paths = ['text', 'pattern', 'demo', 'form', 'kit', 'layout', 'period'] as const;
  for (const section of paths) {
    const expected = Object.keys(galleryTranslations.fr.gallery[section]).sort();
    for (const lang of ['en', 'ja'] as const) {
      assert.deepEqual(Object.keys(galleryTranslations[lang].gallery[section]).sort(), expected, `${lang}.${section}`);
      assert.ok(Object.values(galleryTranslations[lang].gallery[section]).every(value => value.trim()), `${lang}.${section} has an empty label`);
    }
  }
  for (const lang of ['en', 'ja'] as const) {
    assert.deepEqual(Object.keys(galleryTranslations[lang].validation).sort(), Object.keys(galleryTranslations.fr.validation).sort());
  }
});
