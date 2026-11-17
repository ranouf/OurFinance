import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { authorizedReceiptPublicId } from '../src/media';

test('private receipt accepts its original asset or a versioned restore asset only', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  strictEqual(authorizedReceiptPublicId('ourfinance-test/g/e/a', 'g', 'e', 'a'), true);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/e/restore_${id}/a`, 'g', 'e', 'a'), true);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/other/restore_${id}/a`, 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/e/restore_${id}/other`, 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId('ourfinance-test/g/e/restore_fake/a', 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/e/restore_${id}/a/extra`, 'g', 'e', 'a'), false);
});
