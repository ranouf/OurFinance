import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, getDocs, getFirestore } from 'firebase/firestore';

export interface Receipt { readonly id: string; readonly format: 'jpg' | 'png'; readonly ownerId: string; }

export class ReceiptService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl: string) {}

  async list(groupId: string, expenseId: string): Promise<Receipt[]> {
    const snapshot = await getDocs(collection(getFirestore(this.app), 'groups', groupId, 'expenses', expenseId, 'attachments'));
    return snapshot.docs.filter(item => item.data()['status'] === 'active').map(item => ({ id: item.id, format: item.data()['format'] === 'jpg' ? 'jpg' : 'png', ownerId: String(item.data()['ownerId'] ?? '') }));
  }

  async upload(user: User, groupId: string, expenseId: string, file: File): Promise<void> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Choisissez une image PNG ou JPEG.');
    if (file.size > 2_000_000) throw new Error('Image trop volumineuse (maximum 2 Mo).');
    await this.request(user, groupId, expenseId, '', 'POST', file);
  }

  async read(user: User, groupId: string, expenseId: string, receiptId: string): Promise<Blob> {
    return this.request(user, groupId, expenseId, receiptId, 'GET') as Promise<Blob>;
  }

  async remove(user: User, groupId: string, expenseId: string, receiptId: string): Promise<void> {
    await this.request(user, groupId, expenseId, receiptId, 'DELETE');
  }

  private async request(user: User, groupId: string, expenseId: string, receiptId: string, method: 'POST' | 'GET' | 'DELETE', file?: File): Promise<Blob | void> {
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}/attachments${receiptId ? `/${encodeURIComponent(receiptId)}` : ''}`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(file ? { 'Content-Type': file.type } : {}) }, body: file });
    if (!response.ok) throw new Error(response.status === 503 ? 'Reçus désactivés sur cet environnement' : `Reçu indisponible (HTTP ${response.status})`);
    if (method === 'GET') return response.blob();
  }
}
