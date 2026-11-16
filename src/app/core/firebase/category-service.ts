import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { categoryColors, categoryIcons, type CategoryColor, type CategoryIcon, type CustomCategory } from '../../shared/utils/categories';

export interface CategoryDraft { name: string; iconId: CategoryIcon; color: CategoryColor; status: 'active' | 'archived'; }

export class CategoryService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl: string) {}

  async list(groupId: string): Promise<CustomCategory[]> {
    const snapshot = await getDocs(collection(getFirestore(this.app), 'groups', groupId, 'categories'));
    return snapshot.docs.map((item): CustomCategory => {
      const data = item.data();
      const icon = categoryIcons.find(entry => entry.id === data['iconId']) ?? categoryIcons.at(-1)!;
      const color = categoryColors.find(entry => entry.id === data['color']) ?? categoryColors.at(-1)!;
      return { id: item.id, label: String(data['name']), icon: icon.glyph, iconId: icon.id, color: color.id, status: data['status'] === 'archived' ? 'archived' : 'active' };
    }).sort((left, right) => left.label.localeCompare(right.label, 'fr-CA'));
  }

  async create(user: User, groupId: string, draft: CategoryDraft): Promise<string> {
    const categoryId = `custom_${crypto.randomUUID()}`;
    await this.write(user, groupId, categoryId, 'POST', { categoryId, ...draft });
    return categoryId;
  }

  async update(user: User, groupId: string, categoryId: string, draft: CategoryDraft): Promise<void> {
    await this.write(user, groupId, categoryId, 'PATCH', draft);
  }

  private async write(user: User, groupId: string, categoryId: string, method: 'POST' | 'PATCH', body: object): Promise<void> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const path = method === 'POST' ? `/groups/${encodeURIComponent(groupId)}/categories` : `/groups/${encodeURIComponent(groupId)}/categories/${encodeURIComponent(categoryId)}`;
    const url = new URL(path, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(response.status === 503 ? 'Gestion des catégories désactivée sur cet environnement' : `Enregistrement refusé (HTTP ${response.status})`);
  }
}
