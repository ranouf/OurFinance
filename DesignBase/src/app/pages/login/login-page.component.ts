import { Component } from '@angular/core';
import { PublicLayoutComponent } from '../../layouts/public-layout.component';
import { LoginStoryComponent } from './story.component';
import { LoginFormComponent } from './form.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [PublicLayoutComponent, LoginStoryComponent, LoginFormComponent],
  template: `<app-public-layout route="login"><div class="login-layout"><app-login-story /><app-login-form /></div></app-public-layout>`
})
export class LoginPageComponent {}
