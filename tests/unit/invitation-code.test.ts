import { test } from 'node:test';
import { strictEqual, deepStrictEqual } from 'node:assert';
import { parseInvitationCode } from '../../src/app/core/firebase/invitation-service';

test('le code d’invitation contient exactement le groupe, l’invitation et le jeton', () => {
  const token = 'a'.repeat(43);
  deepStrictEqual(parseInvitationCode(` groupe-1.123e4567-e89b-42d3-a456-426614174000.${token} `), {
    groupId: 'groupe-1', invitationId: '123e4567-e89b-42d3-a456-426614174000', token,
  });
  strictEqual(parseInvitationCode(`https://example.com/groupe-1/123e4567-e89b-42d3-a456-426614174000?token=${token}`), null);
  strictEqual(parseInvitationCode(`groupe-1.123e4567-e89b-42d3-a456-426614174000.${token.slice(1)}`), null);
});
