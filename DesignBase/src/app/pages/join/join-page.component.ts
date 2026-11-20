import { Component } from '@angular/core';
import { PublicLayoutComponent } from '../../layouts/public-layout.component';
import { JoinLeftIllustrationComponent } from './leftIllustration.component';
import { JoinRightIllustrationComponent } from './rightIllustration.component';
import { JoinInvitationComponent } from './invitation.component';

@Component({
  selector: 'app-join-page',
  standalone: true,
  imports: [PublicLayoutComponent, JoinLeftIllustrationComponent, JoinRightIllustrationComponent, JoinInvitationComponent],
  template: `<app-public-layout route="join"><img class="join-city" src="./assets/ville-vegetale.png" alt="" aria-hidden="true"><app-join-left-illustration /><app-join-right-illustration /><app-join-invitation /></app-public-layout>`
})
export class JoinPageComponent {}
