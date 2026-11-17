import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { parseNativeSplitwiseCsv, reconcileNativeSplitwiseCsv } from '../../src/app/features/import-export/splitwise-native-csv';

test('lit le CSV natif avec préambule, guillemets et solde final', () => {
  const csv = 'Export fictif\rDate,Description,Catégorie,Coût,Devise,Alice,Bob\r2026-11-01,"Repas, fictif",Restaurant,12.50,CAD,6.25,-6.25\r2026-11-16,Solde total,Total, ,CAD,6.25,-6.25\r';
  const result = parseNativeSplitwiseCsv(csv);
  strictEqual(result.rows.length, 1);
  strictEqual(result.rows[0].description, 'Repas, fictif');
  deepStrictEqual(result.balances, { Alice: '6.25', Bob: '-6.25' });
  strictEqual(reconcileNativeSplitwiseCsv(result).matched, true);
});

test('préserve les fractions exactes d’une devise à zéro décimale', () => {
  const csv = 'Date,Description,Catégorie,Coût,Devise,Alice,Bob\n2026-11-01,Trajet fictif,Transport,101.50,JPY,50.75,-50.75\n2026-11-16,Solde total,Total, ,JPY,50.75,-50.75';
  const result = parseNativeSplitwiseCsv(csv);
  strictEqual(result.rows[0].cost, '101.50');
  deepStrictEqual(result.rows[0].impacts, { Alice: '50.75', Bob: '-50.75' });
  strictEqual(reconcileNativeSplitwiseCsv(result).matched, true);
});

test('signale un écart exact sans arrondi', () => {
  const csv = 'Date,Description,Catégorie,Coût,Devise,Alice,Bob\n2026-11-01,Trajet fictif,Transport,101.50,JPY,50.75,-50.75\n2026-11-16,Solde total,Total, ,JPY,50.70,-50.70';
  deepStrictEqual(reconcileNativeSplitwiseCsv(parseNativeSplitwiseCsv(csv)).differences, { Alice: '0.05', Bob: '-0.05' });
});

test('refuse une transaction dont les impacts exacts ne sont pas équilibrés', () => {
  const csv = 'Date,Description,Catégorie,Coût,Devise,Alice,Bob\n2026-11-01,Trajet fictif,Transport,101.50,JPY,50.75,-50.74';
  throws(() => parseNativeSplitwiseCsv(csv), /impacts non équilibrés/);
});

test('refuse un fichier mélangeant plusieurs devises', () => {
  const csv = 'Date,Description,Catégorie,Coût,Devise,Alice,Bob\n2026-11-01,Trajet fictif,Transport,10.00,CAD,5.00,-5.00\n2026-11-02,Repas fictif,Restaurant,10.00,EUR,5.00,-5.00\n2026-11-16,Solde total,Total, ,CAD,10.00,-10.00';
  throws(() => parseNativeSplitwiseCsv(csv), /devise incohérente/);
});

test('refuse une précision numérique démesurée avant conversion entière', () => {
  const huge = '1'.repeat(100_000);
  const csv = `Date,Description,Catégorie,Coût,Devise,Alice,Bob\n2026-11-01,Trajet fictif,Transport,${huge},JPY,1,-1`;
  throws(() => parseNativeSplitwiseCsv(csv), /transaction Splitwise invalide/);
});
