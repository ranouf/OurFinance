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

test('refuse les exports natifs tronqués, ambigus ou sans solde fiable', () => {
  const header = 'Date,Description,Catégorie,Coût,Devise,Alice,Bob';
  const row = '2026-11-01,Trajet fictif,Transport,10.00,CAD,5.00,-5.00';
  const balance = '2026-11-16,Solde total,Total, ,CAD,5.00,-5.00';
  const cases = [
    ['', /En-tête/],
    ['Date,Description,Catégorie,Coût,Devise', /Colonnes/],
    ['Date,Description,Catégorie,Prix,Devise,Alice,Bob', /Colonnes/],
    ['Date,Description,Catégorie,Coût,Devise,Alice,Alice', /Participants/],
    ['Date,Description,Catégorie,Coût,Devise,Alice, ', /Participants/],
    [`${header}\n${row},extra\n${balance}`, /colonnes/],
    [`${header}\n2026-02-30,Trajet fictif,Transport,10.00,CAD,5.00,-5.00\n${balance}`, /transaction/],
    [`${header}\n2026-11-01,,Transport,10.00,CAD,5.00,-5.00\n${balance}`, /transaction/],
    [`${header}\n2026-11-01,Trajet fictif,Transport,0,CAD,0,0\n${balance}`, /transaction/],
    [`${header}\n2026-11-01,Trajet fictif,Transport,10.00,ZZZ,5.00,-5.00\n${balance}`, /transaction/],
    [`${header}\n${row}\n2026-11-16,Solde total,Total, ,EUR,5.00,-5.00`, /Soldes/],
    [`${header}\n${row}\n2026-11-16,Solde total,Total, ,CAD,invalid,-5.00`, /Soldes/],
    [`${header}\n${row}`, /solde final/],
    [`${header}\n${balance}`, /Soldes/],
  ] as const;
  for (const [csv, error] of cases) throws(() => parseNativeSplitwiseCsv(csv), error, csv);
});

test('refuse la réconciliation quand un participant manque un solde ou un impact', () => {
  const source = parseNativeSplitwiseCsv('Date,Description,Catégorie,Coût,Devise,Alice,Bob\n2026-11-01,Trajet fictif,Transport,10.00,CAD,5.00,-5.00\n2026-11-16,Solde total,Total, ,CAD,5.00,-5.00');
  throws(() => reconcileNativeSplitwiseCsv({ ...source, balances: { Alice: '5.00' } }), /Solde/);
  throws(() => reconcileNativeSplitwiseCsv({ ...source, rows: [{ ...source.rows[0], impacts: { Alice: '5.00' } }] }), /Solde/);
});
