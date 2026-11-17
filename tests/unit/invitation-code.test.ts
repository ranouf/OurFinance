import { test } from 'node:test';
import { strictEqual, deepStrictEqual } from 'node:assert';
import { invitationCodeFromHash, invitationLink, parseInvitationCode } from '../../src/app/core/firebase/invitation-service';

test('le code d’invitation contient exactement le groupe, l’invitation et le jeton', () => {
  const token = 'a'.repeat(43);
  deepStrictEqual(parseInvitationCode(` groupe-1.123e4567-e89b-42d3-a456-426614174000.${token} `), {
    groupId: 'groupe-1', invitationId: '123e4567-e89b-42d3-a456-426614174000', token,
  });
  strictEqual(parseInvitationCode(`https://example.com/groupe-1/123e4567-e89b-42d3-a456-426614174000?token=${token}`), null);
  strictEqual(parseInvitationCode(`groupe-1.123e4567-e89b-42d3-a456-426614174000.${token.slice(1)}`), null);
});

test('le lien garde le secret dans le fragment et permet de récupérer le code', () => {
  const code = `groupe-1.invitation-1.${'a'.repeat(43)}`;
  const link = new URL(invitationLink('https://ourfinance-test.web.app', '/app', code));
  strictEqual(link.origin, 'https://ourfinance-test.web.app');
  strictEqual(link.pathname, '/app');
  strictEqual(link.search, '');
  strictEqual(link.hash.startsWith('#invite='), true);
  strictEqual(invitationCodeFromHash(link.hash), code);
  strictEqual(invitationCodeFromHash('#groups'), null);
  strictEqual(invitationCodeFromHash('#invite=wrong'), null);
});

test('le lien refuse un code ou une origine invalides', () => {
  const code = `groupe-1.invitation-1.${'a'.repeat(43)}`;
  strictEqual(invitationCodeFromHash(`#invite=${code.slice(0, -1)}`), null);
  try { invitationLink('https://ourfinance-test.web.app', 'https://evil.example/', code); throw new Error('Échec attendu'); }
  catch (error) { strictEqual((error as Error).message, 'Origine invalide'); }
});
