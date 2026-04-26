import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'protocolos', loadComponent: () => import('./protocolos/protocolos').then(m => m.Protocolos) },
  { path: 'protocolos/nuevo', loadComponent: () => import('./protocolo-nuevo/protocolo-nuevo').then(m => m.ProtocoloNuevo) },
  { path: 'protocol/:id', loadComponent: () => import('./protocol-detail/protocol-detail').then(m => m.ProtocolDetail) },
  { path: 'protocolos/:id/editar', loadComponent: () => import('./protocol-detail/protocol-detail').then(m => m.ProtocolDetail), data: { startInEditMode: true } },
  { path: 'protocol/:protocolId/patient/:patientId', loadComponent: () => import('./patient-detail/patient-detail').then(m => m.PatientDetail) },
  { path: 'pacientes/nuevo', loadComponent: () => import('./paciente-nuevo/paciente-nuevo').then(m => m.PacienteNuevo) },
  { path: 'mis-pacientes', loadComponent: () => import('./mis-pacientes/mis-pacientes').then(m => m.MisPacientes) },
  { path: 'plantillas', loadComponent: () => import('./plantillas/plantillas').then(m => m.Plantillas) },
  { path: '**', redirectTo: '' },
];
