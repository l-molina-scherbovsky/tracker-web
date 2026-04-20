import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'protocolos', loadComponent: () => import('./protocolos/protocolos').then(m => m.Protocolos) },
  { path: 'protocol/:id', loadComponent: () => import('./protocol-detail/protocol-detail').then(m => m.ProtocolDetail) },
  { path: 'protocol/:protocolId/patient/:patientId', loadComponent: () => import('./patient-detail/patient-detail').then(m => m.PatientDetail) },
  { path: '**', redirectTo: '' },
];
