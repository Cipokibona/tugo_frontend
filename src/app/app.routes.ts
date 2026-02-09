import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { SignUp } from './components/sign-up/sign-up';
import { Home } from './components/home/home';
import { DetailsTrip } from './components/details-trip/details-trip';
import { Chat } from './components/chat/chat';
import { FormTrip } from './components/form-trip/form-trip';
import { HomeAdmin } from './components/home-admin/home-admin';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: Login,
    data: { hideNav: true }
  },
  {
    path: 'sign-up',
    component: SignUp,
    data: { hideNav: true }
  },
  {
    path: 'home',
    component: Home
  },
  {
    path: 'home-admin',
    component: HomeAdmin
  },
  {
    path: 'details-trip/:id',
  component: DetailsTrip
  },
  {
    path: 'chat/:id',
    component: Chat
  },
  {
    path: 'form-trip',
    component: FormTrip
  }
];
