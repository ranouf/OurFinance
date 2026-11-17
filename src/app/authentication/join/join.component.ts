import { Component, inject } from '@angular/core';
import { App } from '../../app';
import { InviteAcceptanceCard } from '../../features/groups/invite-acceptance-card';
import { LoginPage } from '../login/login.component';

@Component({
  imports: [InviteAcceptanceCard, LoginPage],
  templateUrl: './join.component.html',
})
export class JoinPage { readonly app = inject(App); }
