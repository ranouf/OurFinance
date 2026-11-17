function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-CA');
}

export function matchesDescription(description: string, search: string): boolean {
  return normalize(description).includes(normalize(search.trim()));
}
