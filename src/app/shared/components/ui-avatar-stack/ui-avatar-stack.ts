import { Component, Input } from '@angular/core';

export interface UiAvatar { readonly name: string; readonly imageUrl?: string; readonly spritePosition?: string; }

@Component({ selector: 'app-ui-avatar-stack', templateUrl: './ui-avatar-stack.html' })
export class UiAvatarStack {
  @Input() avatars: readonly UiAvatar[] = [];
  @Input() max = 4;
  @Input() label = '';
  visible(): readonly UiAvatar[] { return this.avatars.slice(0, this.max); }
  remaining(): number { return Math.max(0, this.avatars.length - this.max); }
}
