import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService, Protocol } from '../supabase.service';

interface ProtocolCard {
  protocol: Protocol;
  status: string;
  activePatients: number;
  totalPatients: number;
  coordinators: number;
}

@Component({
  selector: 'app-protocolos',
  imports: [RouterLink],
  templateUrl: './protocolos.html',
})
export class Protocolos implements OnInit {
  cards = signal<ProtocolCard[]>([]);
  loading = signal(true);
  error = signal('');

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    try {
      const [protocols, patients] = await Promise.all([
        this.supabase.getProtocols(),
        this.supabase.getAllPatients(),
      ]);

      this.cards.set(protocols.map(p => {
        const pp = patients.filter(pt => pt.protocol_id === p.id);
        return {
          protocol: p,
          status: (p as any).status ?? 'Activo',
          activePatients: pp.filter(pt => pt.status === 'Activo').length,
          totalPatients: pp.length,
          coordinators: new Set(pp.map(pt => pt.coordinator)).size,
        };
      }));
    } catch (e: any) {
      this.error.set(e?.message ?? JSON.stringify(e));
    } finally {
      this.loading.set(false);
    }
  }
}
