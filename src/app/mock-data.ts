export type VisitStatus = 'futura' | 'proxima' | 'realizada' | 'vencida' | 'completa';
export type VisitType = 'V' | 'CT';

export interface ChecklistItem {
  id: string;
  label: string;
  deadline: 'inmediato' | '48hs' | '7dias';
  done: boolean;
}

export interface Visit {
  id: string;
  type: VisitType;
  label: string;
  estimatedDate: string;
  realDate?: string;
  status: VisitStatus;
  checklist: ChecklistItem[];
  notes?: string;
}

export interface Patient {
  id: string;
  initials: string;
  coordinator: string;
  status: 'Activo' | 'Falla de selección';
  visits: Visit[];
}

export interface Protocol {
  id: string;
  name: string;
  patients: Patient[];
}

export const MOCK_PROTOCOLS: Protocol[] = [
  {
    id: 'FLAIR',
    name: 'FLAIR',
    patients: [
      {
        id: 'FL-001',
        initials: 'J.G.',
        coordinator: 'Ana Torres',
        status: 'Activo',
        visits: [
          {
            id: 'v1', type: 'V', label: 'V1',
            estimatedDate: '12/01/25', realDate: '12/01/25',
            status: 'completa',
            checklist: [
              { id: 'c1', label: 'Consentimiento firmado', deadline: 'inmediato', done: true },
              { id: 'c2', label: 'Medicación dispensada', deadline: 'inmediato', done: true },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: true },
              { id: 'c4', label: 'Reporte de lab recibido', deadline: '7dias', done: true },
              { id: 'c5', label: 'Reporte archivado en folio', deadline: '7dias', done: true },
            ],
          },
          {
            id: 'v2', type: 'V', label: 'V2',
            estimatedDate: '09/02/25', realDate: '10/02/25',
            status: 'realizada',
            checklist: [
              { id: 'c1', label: 'Medicación dispensada/devuelta', deadline: 'inmediato', done: true },
              { id: 'c2', label: 'Adherencia chequeada', deadline: 'inmediato', done: true },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: true },
              { id: 'c4', label: 'Reporte de lab recibido', deadline: '7dias', done: true },
              { id: 'c5', label: 'Reporte archivado en folio', deadline: '7dias', done: false },
            ],
            notes: 'Paciente refirió leve disnea al esfuerzo. Se notificó al investigador.',
          },
          {
            id: 'ct1', type: 'CT', label: 'CT1',
            estimatedDate: '24/02/25', realDate: '24/02/25',
            status: 'completa',
            checklist: [
              { id: 'c1', label: 'Contacto telefónico realizado', deadline: 'inmediato', done: true },
              { id: 'c2', label: 'Adherencia a medicación chequeada', deadline: 'inmediato', done: true },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: true },
            ],
          },
          {
            id: 'v3', type: 'V', label: 'V3',
            estimatedDate: '22/04/25',
            status: 'proxima',
            checklist: [
              { id: 'c1', label: 'Medicación dispensada/devuelta', deadline: 'inmediato', done: false },
              { id: 'c2', label: 'Adherencia chequeada', deadline: 'inmediato', done: false },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: false },
              { id: 'c4', label: 'Reporte de lab recibido', deadline: '7dias', done: false },
              { id: 'c5', label: 'Reporte archivado en folio', deadline: '7dias', done: false },
            ],
          },
          {
            id: 'v4', type: 'V', label: 'V4',
            estimatedDate: '20/07/25',
            status: 'futura',
            checklist: [],
          },
        ],
      },
      {
        id: 'FL-002',
        initials: 'M.R.',
        coordinator: 'Ana Torres',
        status: 'Activo',
        visits: [
          {
            id: 'v1', type: 'V', label: 'V1',
            estimatedDate: '05/02/25', realDate: '05/02/25',
            status: 'completa',
            checklist: [
              { id: 'c1', label: 'Consentimiento firmado', deadline: 'inmediato', done: true },
              { id: 'c2', label: 'Medicación dispensada', deadline: 'inmediato', done: true },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: true },
              { id: 'c4', label: 'Reporte de lab recibido', deadline: '7dias', done: true },
              { id: 'c5', label: 'Reporte archivado en folio', deadline: '7dias', done: true },
            ],
          },
          {
            id: 'v2', type: 'V', label: 'V2',
            estimatedDate: '05/03/25', realDate: '06/03/25',
            status: 'vencida',
            checklist: [
              { id: 'c1', label: 'Medicación dispensada/devuelta', deadline: 'inmediato', done: true },
              { id: 'c2', label: 'Adherencia chequeada', deadline: 'inmediato', done: true },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: false },
              { id: 'c4', label: 'Reporte de lab recibido', deadline: '7dias', done: false },
              { id: 'c5', label: 'Reporte archivado en folio', deadline: '7dias', done: false },
            ],
          },
          {
            id: 'ct1', type: 'CT', label: 'CT1',
            estimatedDate: '20/03/25',
            status: 'futura',
            checklist: [],
          },
          {
            id: 'v3', type: 'V', label: 'V3',
            estimatedDate: '03/06/25',
            status: 'futura',
            checklist: [],
          },
        ],
      },
      {
        id: 'FL-003',
        initials: 'C.L.',
        coordinator: 'Pedro Sosa',
        status: 'Activo',
        visits: [
          {
            id: 'v1', type: 'V', label: 'V1',
            estimatedDate: '15/03/25', realDate: '15/03/25',
            status: 'completa',
            checklist: [
              { id: 'c1', label: 'Consentimiento firmado', deadline: 'inmediato', done: true },
              { id: 'c2', label: 'Medicación dispensada', deadline: 'inmediato', done: true },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: true },
              { id: 'c4', label: 'Reporte de lab recibido', deadline: '7dias', done: true },
              { id: 'c5', label: 'Reporte archivado en folio', deadline: '7dias', done: true },
            ],
          },
          {
            id: 'v2', type: 'V', label: 'V2',
            estimatedDate: '22/04/25',
            status: 'proxima',
            checklist: [
              { id: 'c1', label: 'Medicación dispensada/devuelta', deadline: 'inmediato', done: false },
              { id: 'c2', label: 'Adherencia chequeada', deadline: 'inmediato', done: false },
              { id: 'c3', label: 'EDC completado', deadline: '48hs', done: false },
              { id: 'c4', label: 'Reporte de lab recibido', deadline: '7dias', done: false },
              { id: 'c5', label: 'Reporte archivado en folio', deadline: '7dias', done: false },
            ],
          },
          {
            id: 'v3', type: 'V', label: 'V3',
            estimatedDate: '20/07/25',
            status: 'futura',
            checklist: [],
          },
        ],
      },
      {
        id: 'FL-004',
        initials: 'R.M.',
        coordinator: 'Pedro Sosa',
        status: 'Falla de selección',
        visits: [
          {
            id: 'v1', type: 'V', label: 'V1',
            estimatedDate: '10/01/25', realDate: '10/01/25',
            status: 'completa',
            checklist: [],
          },
        ],
      },
    ],
  },
  {
    id: 'AURORA',
    name: 'AURORA',
    patients: [
      {
        id: 'AU-001', initials: 'L.P.', coordinator: 'Ana Torres', status: 'Activo',
        visits: [
          { id: 'v1', type: 'V', label: 'V1', estimatedDate: '01/04/25', realDate: '01/04/25', status: 'realizada', checklist: [], notes: '' },
          { id: 'v2', type: 'V', label: 'V2', estimatedDate: '30/04/25', status: 'proxima', checklist: [] },
        ],
      },
      {
        id: 'AU-002', initials: 'S.B.', coordinator: 'Pedro Sosa', status: 'Activo',
        visits: [
          { id: 'v1', type: 'V', label: 'V1', estimatedDate: '15/04/25', status: 'proxima', checklist: [] },
        ],
      },
    ],
  },
];

export const MOCK_ALERTS = [
  { id: 1, type: 'vencido', message: 'FL-002 · V2 — EDC y reporte de lab vencidos', protocol: 'FLAIR', coordinator: 'Ana Torres' },
  { id: 2, type: 'proximo', message: 'FL-001 · V3 — Visita dentro de 4 días (22/04)', protocol: 'FLAIR', coordinator: 'Ana Torres' },
  { id: 3, type: 'proximo', message: 'FL-003 · V2 — Visita dentro de 4 días (22/04)', protocol: 'FLAIR', coordinator: 'Pedro Sosa' },
  { id: 4, type: 'proximo', message: 'AU-001 · V2 — Visita dentro de 12 días (30/04)', protocol: 'AURORA', coordinator: 'Ana Torres' },
];
