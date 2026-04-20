import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService, Protocol, Patient, Visit, ChecklistItem } from '../supabase.service';

interface ProtocolSummary {
  protocol: Protocol;
  activePatients: number;
}

interface Alert {
  id: string;
  type: 'vencido';
  message: string;
  protocol: string;
  coordinator: string;
}

interface TodayVisitRow {
  visit: Visit;
  patient: Patient;
}

interface TodayGroup {
  protocolId: string;
  protocolName: string;
  rows: TodayVisitRow[];
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  protocols = signal<ProtocolSummary[]>([]);
  alerts = signal<Alert[]>([]);
  totalPatients = signal(0);
  pendingLabs = signal(0);
  upcomingVisits = signal(0);
  todayGroups = signal<TodayGroup[]>([]);
  loading = signal(true);
  error = signal('');
  alertsCollapsed = false;

  private readonly COORDINATOR = 'Ana Torres';

  private readonly MONTHS = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ];

  get todayLabel(): string {
    const d = new Date();
    return `${d.getDate()} de ${this.MONTHS[d.getMonth()]}`;
  }

  constructor(private supabase: SupabaseService) {}

  /**
   * Devuelve el plazo en horas del ítem.
   * Usa plazo_horas si ya fue migrado; si no, mapea desde el campo deadline.
   * Esto hace la lógica resiliente tanto antes como después de correr la migración SQL.
   */
  private resolvePlazo(item: ChecklistItem): number | null {
    if (item.plazo_horas != null) return item.plazo_horas;
    switch (item.deadline) {
      case 'inmediato': return 0;
      case '48hs':      return 48;
      case '7dias':     return 168;
      default:          return null;
    }
  }

  async ngOnInit() {
    try {
      const [protocols, patients, visits, checklist] = await Promise.all([
        this.supabase.getProtocols(),
        this.supabase.getAllPatients(),
        this.supabase.getAllVisits(),
        this.supabase.getAllChecklistItems(),
      ]);

      const visitMap   = new Map(visits.map(v => [v.id, v]));
      const patientMap = new Map(patients.map(p => [p.id, p]));
      const now        = Date.now();

      // Métricas básicas
      this.protocols.set(protocols.map(p => ({
        protocol: p,
        activePatients: patients.filter(pt => pt.protocol_id === p.id && pt.status === 'Activo').length,
      })));
      this.totalPatients.set(patients.filter(p => p.status === 'Activo').length);
      this.upcomingVisits.set(visits.filter(v => v.status === 'proxima').length);

      // Alertas: ítem no hecho, visita realizada, plazo vencido
      // Mismo loop para alertas Y para la métrica "Labs vencidos"
      const realAlerts: Alert[] = [];
      let labsVencidos = 0;

      for (const item of checklist) {
        if (item.done) continue;

        const plazo = this.resolvePlazo(item);
        if (plazo === null) continue;

        const visit = visitMap.get(item.visit_id);
        if (!visit?.real_date) continue; // visita no realizada, no aplica

        const vencimientoMs = new Date(visit.real_date).getTime() + plazo * 3_600_000;
        if (vencimientoMs >= now) continue; // dentro de plazo todavía

        // Ítem vencido
        if (plazo === 168) labsVencidos++; // solo los de 7 días cuentan para la métrica de labs

        const patient = patientMap.get(visit.patient_id);
        if (!patient) continue;

        const proto = protocols.find(p => p.id === patient.protocol_id);
        realAlerts.push({
          id: item.id,
          type: 'vencido',
          message: `${patient.id} · ${visit.label} — ${item.label}`,
          protocol: proto?.name ?? patient.protocol_id,
          coordinator: patient.coordinator,
        });
      }

      this.pendingLabs.set(labsVencidos);
      this.alerts.set(realAlerts);

      // Visitas de hoy filtradas por coordinador
      const today = new Date().toISOString().slice(0, 10);
      const todayRows = visits
        .filter(v => {
          const dateOk =
            v.estimated_date?.slice(0, 10) === today ||
            v.real_date?.slice(0, 10) === today;
          if (!dateOk) return false;
          return patientMap.get(v.patient_id)?.coordinator === this.COORDINATOR;
        })
        .map(v => ({ visit: v, patient: patientMap.get(v.patient_id)! }));

      const groupMap = new Map<string, TodayGroup>();
      for (const row of todayRows) {
        const pid = row.patient.protocol_id;
        if (!groupMap.has(pid)) {
          const proto = protocols.find(p => p.id === pid);
          groupMap.set(pid, { protocolId: pid, protocolName: proto?.name ?? pid, rows: [] });
        }
        groupMap.get(pid)!.rows.push(row);
      }
      this.todayGroups.set([...groupMap.values()]);

    } catch (e: any) {
      this.error.set(e?.message ?? JSON.stringify(e));
      console.error('Supabase error:', e);
    } finally {
      this.loading.set(false);
    }
  }

  fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    if (d.length >= 10 && d[4] === '-') {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y.slice(2)}`;
    }
    return d;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      futura: 'Futura', proxima: 'Próxima', realizada: 'Realizada',
      vencida: 'Ítems vencidos', completa: 'Completa',
    };
    return map[status] ?? status;
  }
}
