import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { SupabaseService, Protocol, Patient, Visit } from '../supabase.service';
import { PatientDetailPanelComponent } from '../patient-detail-panel/patient-detail-panel';

interface WeekDay {
  date: string;
  label: string;
  shortKey: string;
  count: number;
}

interface PatientVisitRow {
  patient: Patient;
  visit: Visit;
  protocol: Protocol;
  expanded: boolean;
}

interface ProtocolGroup {
  protocol: Protocol;
  rows: PatientVisitRow[];
}

@Component({
  selector: 'app-mis-pacientes',
  imports: [PatientDetailPanelComponent],
  templateUrl: './mis-pacientes.html',
})
export class MisPacientes implements OnInit {
  private readonly COORDINATOR = 'Ana Torres';

  loading = signal(true);
  error = signal('');

  allProtocols: Protocol[] = [];
  myPatients: Patient[] = [];
  allVisits: Visit[] = [];

  weekDays: WeekDay[] = [];
  selectedDay = 'hoy';

  selectedProtocolId = '';
  selectedVisitStatus = '';

  readonly visitStatusOptions = [
    { value: 'proxima',   label: 'Próxima' },
    { value: 'realizada', label: 'Realizada' },
    { value: 'lab',       label: 'Lab pendiente' },
    { value: 'vencida',   label: 'Vencida' },
    { value: 'completa',  label: 'Completa' },
  ];

  groups: ProtocolGroup[] = [];

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const [protocols, patients, visits] = await Promise.all([
        this.supabase.getProtocols(),
        this.supabase.getAllPatients(),
        this.supabase.getAllVisits(),
      ]);

      this.allProtocols = protocols;
      this.myPatients = patients.filter(p => p.coordinator === this.COORDINATOR);
      const patientIds = new Set(this.myPatients.map(p => p.id));
      this.allVisits = visits.filter(v => patientIds.has(v.patient_id));

      this.buildWeekDays();
      this.applyFilters();
    } catch (e: any) {
      this.error.set(e?.message ?? JSON.stringify(e));
    } finally {
      this.loading.set(false);
    }
  }

  private buildWeekDays() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

    const todayMM = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    this.weekDays = [{
      date: todayStr,
      label: `Hoy · ${todayMM}`,
      shortKey: 'hoy',
      count: this.countVisitsForDay(todayStr),
    }];

    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    const dayKeys   = ['lun', 'mar', 'mie', 'jue', 'vie'];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      this.weekDays.push({
        date: dStr,
        label: dayLabels[i],
        shortKey: dayKeys[i],
        count: this.countVisitsForDay(dStr),
      });
    }

    this.weekDays.push({ date: '', label: 'Todos', shortKey: 'todos', count: 0 });
  }

  private countVisitsForDay(dateStr: string): number {
    return this.allVisits.filter(v => v.estimated_date?.slice(0, 10) === dateStr).length;
  }

  selectDay(key: string) {
    this.selectedDay = key;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  setProtocolFilter(id: string) {
    this.selectedProtocolId = id;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  setStatusFilter(value: string) {
    this.selectedVisitStatus = value;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  clearFilters() {
    this.selectedProtocolId = '';
    this.selectedVisitStatus = '';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  get hasActiveFilters(): boolean {
    return !!(this.selectedProtocolId || this.selectedVisitStatus);
  }

  get selectedProtocolLabel(): string {
    return this.allProtocols.find(p => p.id === this.selectedProtocolId)?.name ?? '';
  }

  get selectedStatusLabel(): string {
    return this.visitStatusOptions.find(o => o.value === this.selectedVisitStatus)?.label ?? '';
  }

  get myProtocols(): Protocol[] {
    const ids = new Set(this.myPatients.map(p => p.protocol_id));
    return this.allProtocols.filter(p => ids.has(p.id));
  }

  get totalPatients(): number { return this.myPatients.length; }

  get totalProtocols(): number {
    return new Set(this.myPatients.map(p => p.protocol_id)).size;
  }

  groupCountLabel(count: number): string {
    const unit = this.selectedDay === 'todos' ? 'paciente' : 'visita';
    return `${count} ${unit}${count !== 1 ? 's' : ''}`;
  }

  private applyFilters() {
    const patientMap = new Map(this.myPatients.map(p => [p.id, p]));
    const protocolMap = new Map(this.allProtocols.map(p => [p.id, p]));
    const visitsByPatient = new Map<string, Visit[]>();
    for (const v of this.allVisits) {
      if (!visitsByPatient.has(v.patient_id)) visitsByPatient.set(v.patient_id, []);
      visitsByPatient.get(v.patient_id)!.push(v);
    }

    const rows: PatientVisitRow[] = [];

    if (this.selectedDay === 'todos') {
      for (const patient of this.myPatients) {
        if (this.selectedProtocolId && patient.protocol_id !== this.selectedProtocolId) continue;
        const protocol = protocolMap.get(patient.protocol_id);
        if (!protocol) continue;
        const patientVisits = visitsByPatient.get(patient.id) ?? [];

        let visit: Visit | null;
        if (this.selectedVisitStatus) {
          const matching = patientVisits.filter(v => this.matchesStatusFilter(v));
          if (matching.length === 0) continue;
          visit = matching[0];
        } else {
          visit = this.getMostRelevantVisit(patientVisits);
          if (!visit) continue;
        }

        rows.push({ patient, visit, protocol, expanded: false });
      }
    } else {
      const dayEntry = this.weekDays.find(d => d.shortKey === this.selectedDay);
      const dateFilter = dayEntry?.date ?? '';

      for (const v of this.allVisits) {
        if (v.estimated_date?.slice(0, 10) !== dateFilter) continue;
        const patient = patientMap.get(v.patient_id);
        if (!patient) continue;
        if (this.selectedProtocolId && patient.protocol_id !== this.selectedProtocolId) continue;
        if (this.selectedVisitStatus && !this.matchesStatusFilter(v)) continue;
        const protocol = protocolMap.get(patient.protocol_id);
        if (!protocol) continue;
        rows.push({ patient, visit: v, protocol, expanded: false });
      }
    }

    rows.sort((a, b) => {
      if (a.protocol.id !== b.protocol.id) return a.protocol.id.localeCompare(b.protocol.id);
      if (a.patient.id !== b.patient.id) return a.patient.id.localeCompare(b.patient.id);
      return (a.visit.sort_order ?? 0) - (b.visit.sort_order ?? 0);
    });

    const groupMap = new Map<string, ProtocolGroup>();
    for (const row of rows) {
      if (!groupMap.has(row.protocol.id)) {
        groupMap.set(row.protocol.id, { protocol: row.protocol, rows: [] });
      }
      groupMap.get(row.protocol.id)!.rows.push(row);
    }
    this.groups = [...groupMap.values()];
  }

  private matchesStatusFilter(visit: Visit): boolean {
    const st = this.displayStatus(visit);
    switch (this.selectedVisitStatus) {
      case 'proxima':   return st === 'proxima';
      case 'realizada': return !!visit.real_date && st === 'realizada';
      case 'lab':       return !!visit.real_date && st === 'vencida';
      case 'vencida':   return !visit.real_date && st === 'vencida';
      case 'completa':  return st === 'completa';
      default:          return true;
    }
  }

  private getMostRelevantVisit(visits: Visit[]): Visit | null {
    if (visits.length === 0) return null;
    const proxima = visits.filter(v => this.displayStatus(v) === 'proxima');
    if (proxima.length > 0) return proxima.sort((a, b) => a.estimated_date.localeCompare(b.estimated_date))[0];
    const futura = visits.filter(v => this.displayStatus(v) === 'futura');
    if (futura.length > 0) return futura.sort((a, b) => a.estimated_date.localeCompare(b.estimated_date))[0];
    const realizada = visits.filter(v => this.displayStatus(v) === 'realizada');
    if (realizada.length > 0) return realizada.sort((a, b) => (b.real_date ?? '').localeCompare(a.real_date ?? ''))[0];
    return visits.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
  }

  toggleRow(row: PatientVisitRow) {
    row.expanded = !row.expanded;
    this.cdr.detectChanges();
  }

  displayStatus(visit: Visit): string {
    if (visit.real_date) return visit.status;
    const now = Date.now();
    const daysUntil = (new Date(visit.estimated_date).getTime() - now) / 86_400_000;
    if (daysUntil > 7)  return 'futura';
    if (daysUntil >= 0) return 'proxima';
    return 'vencida';
  }

  visitBadgeLabel(visit: Visit): string {
    const status = this.displayStatus(visit);
    if (status === 'vencida') return visit.real_date ? 'Lab pend.' : 'Vencida';
    const map: Record<string, string> = {
      futura: 'Futura', proxima: 'Próxima', realizada: 'Realizada', completa: 'Completa',
    };
    return map[status] ?? status;
  }

  fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    if (d.length >= 10 && d[4] === '-') {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y.slice(2)}`;
    }
    return d;
  }
}
