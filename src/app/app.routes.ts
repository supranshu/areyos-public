import { Routes } from '@angular/router';
import { Navigate } from './features/navigate/navigate';

export const routes: Routes = [
  // The backend encodes `{public-base-url}/qr/{code}` into every printed QR code (QRPointResponse.scanUrl).
  { path: 'qr/:code', component: Navigate },
  { path: 'navigate/:code', component: Navigate },
  // No code: Navigate shows its idle "scan a QR code" state.
  { path: '', component: Navigate, pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
