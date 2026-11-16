export const categories = [
  { id: 'food', label: 'Alimentation', icon: '🛒' },
  { id: 'housing', label: 'Logement', icon: '🏠' },
  { id: 'transport', label: 'Transport', icon: '🚇' },
  { id: 'health', label: 'Santé', icon: '🩺' },
  { id: 'education', label: 'Scolarité', icon: '🎓' },
  { id: 'leisure', label: 'Loisirs', icon: '🎭' },
  { id: 'gifts', label: 'Cadeaux', icon: '🎁' },
  { id: 'services', label: 'Services', icon: '🛠️' },
  { id: 'other', label: 'Autre', icon: '📌' },
] as const;

export type CategoryId = typeof categories[number]['id'];
export function categoryById(id: string) { return categories.find(category => category.id === id) ?? categories.at(-1)!; }
