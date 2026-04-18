import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService, Protocol } from '../supabase.service';
import { MOCK_ALERTS } from '../mock-data';

interface ProtocolSummary {
  protocol: Protocol;
  activePatients: number;
}

interface Alert {
  id: number;
  type: string;
  message: string;
  protocol: string;
  coordinator: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  protocols = signal<ProtocolSummary[]>([]);
  alerts = signal<Alert[]>(MOCK_ALERTS);
  totalPatients = signal(0);
  pendingLabs = signal(0);
  upcomingVisits = signal(0);
  loading = signal(true);
  error = signal('');

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    try {
      const [protocols, patients, visits, checklist] = await Promise.all([
        this.supabase.getProtocols(),
        this.supabase.getAllPatients(),
        this.supabase.getAllVisits(),
        this.supabase.getAllChecklistItems(),
      ]);

      this.protocols.set(protocols.map(p => ({
        protocol: p,
        activePatients: patients.filter(pt => pt.protocol_id === p.id && pt.status === 'Activo').length,
      })));

      this.totalPatients.set(patients.filter(p => p.status === 'Activo').length);
      this.upcomingVisits.set(visits.filter(v => v.status === 'proxima').length);
      this.pendingLabs.set(checklist.filter(i => !i.done && i.deadline === '7dias').length);
    } catch (e: any) {
      this.error.set(e?.message ?? JSON.stringify(e));
      console.error('Supabase error:', e);
    } finally {
      this.loading.set(false);
    }
  }
}
