/** RFC 4180 style parser for user-supplied local CSV; never transmits file contents. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field === '') quoted = true;
      else if (quoted) quoted = false;
      else throw new Error('Guillemets CSV invalides');
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Champ CSV non fermé');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
