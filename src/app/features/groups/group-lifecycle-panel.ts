import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { GroupLifecycleRequestError, GroupService } from '../../core/firebase/group-service';
import type { Group, GroupMember } from '../../core/firebase/group-model';
import { loadSharedMemberProfiles } from '../../core/firebase/member-profile-service';
import { language } from '../../shared/utils/i18n';
import { groupLifecycleText } from './group-lifecycle-text';

@Component({
  selector: 'app-group-lifecycle-panel',
  imports: [RouterLink],
  templateUrl: './group-lifecycle-panel.html',
})
export class GroupLifecyclePanel implements OnChanges {
  @Input({ required: true }) group!: Group;
  @Input({ required: true }) user!: User;
  @Input({ required: true }) firebaseApp!: FirebaseApp;
  @Input({ required: true }) workerUrl = '';
  @Output() readonly changed = new EventEmitter<void>();
  readonly text = computed(() => groupLifecycleText[language()]);
  readonly members = signal<GroupMember[]>([]);
  readonly names = signal<Record<string, string>>({});
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly pending = signal<{ kind: 'archive' } | { kind: 'revoke'; memberId: string } | null>(null);
  private requestId = 0;

  ngOnChanges(): void { this.pending.set(null); this.message.set(''); void this.load(); }
  activeMembers(): GroupMember[] { return this.members().filter(member => member.status === 'active'); }
  canManage(): boolean { return this.group.status === 'active' && this.group.ownerId === this.user.uid; }
  label(member: GroupMember): string { return member.userId === this.user.uid ? this.text().you : this.names()[member.userId] || `${this.text().member} ${member.userId.slice(0, 8)}`; }
  initial(member: GroupMember): string {
    const name = member.userId === this.user.uid ? this.user.displayName || this.text().you : this.label(member);
    return name.trim().charAt(0).toUpperCase();
  }
  private async load(): Promise<void> {
    const requestId = ++this.requestId;
    this.loading.set(true); this.loadError.set(false); this.members.set([]); this.names.set({});
    try {
      const [members, names] = await Promise.all([
        new GroupService(this.firebaseApp, this.workerUrl).members(this.group.id),
        loadSharedMemberProfiles(this.workerUrl, this.group.id, this.user).catch(() => []),
      ]);
      if (requestId !== this.requestId) return;
      this.members.set(members);
      this.names.set(Object.fromEntries(names.filter(item => item.displayName).map(item => [item.userId, item.displayName!])));
    } catch { if (requestId === this.requestId) this.loadError.set(true); }
    finally { if (requestId === this.requestId) this.loading.set(false); }
  }

  async confirm(): Promise<void> {
    const action = this.pending();
    if (!action || !this.canManage() || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      const service = new GroupService(this.firebaseApp, this.workerUrl);
      if (action.kind === 'archive') await service.archive(this.user, this.group.id);
      else await service.revokeMember(this.user, this.group.id, action.memberId);
      this.pending.set(null);
      this.changed.emit();
      if (action.kind === 'revoke') await this.load();
    } catch (error) {
      this.message.set(this.text()[error instanceof GroupLifecycleRequestError && error.status === 503 ? 'actionUnavailable' : 'actionFailed']);
    } finally { this.busy.set(false); }
  }
}
