import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService, Patient, Visit } from '../supabase.service';

interface PatientRow {
  patient: Patient;
  visits: Visit[];
}

@Component({
  selector: 'app-protocol-detail',
  imports: [RouterLink],
  templateUrl: './protocol-detail.html',
})
export class ProtocolDetail implements OnInit {
  protocolId = '';
  rows: PatientRow[] = [];
  filtered: PatientRow[] = [];
  selectedCoordinator = 'Todos';
  loading = true;

  get coordinators() {
    const set = new Set(this.rows.map(r => r.patient.coordinator));
    return ['Todos', ...set];
  }

  constructor(private route: ActivatedRoute, private supabase: SupabaseService) {}

  async ngOnInit() {
    this.protocolId = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      const patients = await this.supabase.getPatients(this.protocolId);
      const rows: PatientRow[] = [];
      for (const patient of patients) {
        const visits = await this.supabase.getVisits(patient.id);
        rows.push({ patient, visits });
      }
      this.rows = rows;
      this.applyFilter();
    } finally {
      this.loading = false;
    }
  }

  applyFilter() {
    this.filtered = this.selectedCoordinator === 'Todos'
      ? this.rows
      : this.rows.filter(r => r.patient.coordinator === this.selectedCoordinator);
  }

  filterBy(coord: string) {
    this.selectedCoordinator = coord;
    this.applyFilter();
  }

  chipClass(status: string): string {
    const base = 'inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold min-w-[44px] cursor-pointer border ';
    switch (status) {
      case 'futura':    return base + 'bg-gray-100 text-gray-500 border-gray-200';
      case 'proxima':   return base + 'bg-blue-100 text-blue-700 border-blue-200';
      case 'realizada': return base + 'bg-green-100 text-green-700 border-green-300';
      case 'vencida':   return base + 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'completa':  return base + 'bg-green-500 text-white border-green-600';
      default:          return base + 'bg-gray-100 text-gray-500 border-gray-200';
    }
  }
}
