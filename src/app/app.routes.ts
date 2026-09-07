import { Routes } from '@angular/router';
import { Navigate } from './features/navigate/navigate';

export const routes: Routes = [
  { path: 'navigate/:code', component: Navigate },
  { path: '', redirectTo: 'navigate', pathMatch: 'full' },
];