import { categoryColors, categoryIcons } from '../../shared/utils/categories';

export interface GroupMetadata {
  readonly name: string;
  readonly iconId?: string;
  readonly color?: string;
  readonly description?: string;
}

/** Shared allowlists keep stored values renderable and reject arbitrary markup or colours. */
export function validateGroupMetadata(value: unknown): GroupMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_group_metadata');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['name', 'iconId', 'color', 'description'].includes(key))) throw new Error('invalid_group_metadata');
  const name = typeof input['name'] === 'string' ? input['name'].trim() : '';
  if (!name || name.length > 80 ||
      (input['iconId'] !== undefined && !categoryIcons.some(icon => icon.id === input['iconId'])) ||
      (input['color'] !== undefined && !categoryColors.some(color => color.id === input['color'])) ||
      (input['description'] !== undefined && (typeof input['description'] !== 'string' || input['description'].trim().length > 500))) {
    throw new Error('invalid_group_metadata');
  }
  return { name,
    ...(input['iconId'] !== undefined ? { iconId: input['iconId'] as string } : {}),
    ...(input['color'] !== undefined ? { color: input['color'] as string } : {}),
    ...(input['description'] !== undefined ? { description: (input['description'] as string).trim() } : {}),
  };
}
