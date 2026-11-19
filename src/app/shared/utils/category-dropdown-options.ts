import type { CategoryDefinition } from './categories';
import type { DropdownOption } from '../components/dropdown/dropdown.component';

/** Lucide icons available in the UI kit; retain the category glyph when no match exists. */
export function categoryDropdownIcon(id: string): DropdownOption['iconName'] {
  if (id === 'groceries' || id === 'food' || id === 'cart') return 'shopping-cart';
  if (id === 'rent' || id === 'housing' || id === 'home') return 'house';
  if (id === 'restaurant') return 'utensils';
  if (id === 'transport') return 'tram-front';
  if (id === 'education') return 'graduation-cap';
  if (id === 'health') return 'heart-pulse';
  if (id === 'leisure') return 'ticket';
  if (id === 'gifts' || id === 'gift') return 'gift';
  if (id === 'services' || id === 'tools') return 'wrench';
  if (id === 'other' || id === 'pin') return 'map-pin';
  return undefined;
}

export function categoryDropdownTone(color: CategoryDefinition['color']): NonNullable<DropdownOption['tone']> {
  if (color === 'rose') return 'coral';
  if (color === 'sky') return 'sky';
  if (color === 'amber') return 'amber';
  if (color === 'teal') return 'mint';
  return 'violet';
}

export function categoryDropdownOptions(
  categories: readonly CategoryDefinition[],
  label: (category: CategoryDefinition) => string,
  placeholder?: string,
): DropdownOption[] {
  const choices = categories.map(category => {
    const iconId = 'iconId' in category && typeof category.iconId === 'string' ? category.iconId : category.id;
    const iconName = categoryDropdownIcon(iconId);
    return {
      value: category.id,
      label: `${iconName ? '' : category.icon + ' '}${label(category)}`,
      iconName,
      tone: categoryDropdownTone(category.color),
    };
  });
  return placeholder === undefined ? choices : [{ value: '', label: placeholder }, ...choices];
}
