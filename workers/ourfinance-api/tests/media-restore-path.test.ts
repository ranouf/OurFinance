import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { authorizedReceiptPublicId } from '../src/media';

test('private receipt accepts its original asset or a versioned restore asset only', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  strictEqual(authorizedReceiptPublicId('ourfinance-test/g/e/a', 'ourfinance-test', 'g', 'e', 'a'), true);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/e/restore_${id}/a`, 'ourfinance-test', 'g', 'e', 'a'), true);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/other/restore_${id}/a`, 'ourfinance-test', 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/e/restore_${id}/other`, 'ourfinance-test', 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId('ourfinance-test/g/e/restore_fake/a', 'ourfinance-test', 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId(`ourfinance-test/g/e/restore_${id}/a/extra`, 'ourfinance-test', 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId('ourfinance-prod/g/e/a', 'ourfinance-test', 'g', 'e', 'a'), false);
  strictEqual(authorizedReceiptPublicId('ourfinance-prod/g/e/a', 'ourfinance-prod', 'g', 'e', 'a'), true);
});
