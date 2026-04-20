import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Patient, Visit, ChecklistItem } from '../supabase.service';

interface ChecklistGroup { label: string; items: ChecklistItem[]; }

interface PatientRow {
  patient: Patient;
  visits: Visit[];
  expanded: boolean;
  selectedVisit: Visit | null;
  checklist: ChecklistItem[];
  noteText: string;
  savingNote: boolean;
  loadingVisit: boolean;
}

@Component({
  selector: 'app-protocol-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './protocol-detail.html',
})
export class ProtocolDetail implements OnInit {
  protocolId = '';
  rows: PatientRow[] = [];
  filtered: PatientRow[] = [];
  selectedCoordinator = 'Todos';
  loading = signal(true);
  error = signal('');

  get coordinators() {
    const set = new Set(this.rows.map(r => r.patient.coordinator));
    return ['Todos', ...set];
  }

  constructor(
    private route: ActivatedRoute,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.protocolId = this.route.snapshot.paramMap.get('id') ?? '';
    console.log('[ProtocolDetail] protocolId desde URL:', this.protocolId);

    try {
      const patients = await this.supabase.getPatients(this.protocolId);
      console.log('[ProtocolDetail] pacientes recibidos:', patients.length, patients);

      const rows: PatientRow[] = [];
      for (const patient of patients) {
        const visits = await this.supabase.getVisits(patient.id);
        console.log(`[ProtocolDetail] visitas para ${patient.id}:`, visits.length);
        rows.push({
          patient, visits,
          expanded: false, selectedVisit: null,
          checklist: [], noteText: '',
          savingNote: false, loadingVisit: false,
        });
      }
      this.rows = rows;
      this.applyFilter();
    } catch (e: any) {
      const msg = e?.message ?? JSON.stringify(e);
      console.error('[ProtocolDetail] error Supabase:', msg, e);
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    this.filtered = this.selectedCoordinator === 'Todos'
      ? this.rows
      : this.rows.filter(r => r.patient.coordinator === this.selectedCoordinator);
    this.cdr.detectChanges();
  }

  filterBy(coord: string) {
    this.selectedCoordinator = coord;
    this.applyFilter();
  }

  async togglePatient(row: PatientRow) {
    if (row.expanded) {
      row.expanded = false;
      this.cdr.detectChanges();
      return;
    }
    row.expanded = true;
    this.cdr.detectChanges();
    if (!row.selectedVisit && row.visits.length > 0) {
      await this.selectVisit(row, row.visits[0]);
    }
  }

  async selectVisit(row: PatientRow, visit: Visit) {
    row.selectedVisit = visit;
    row.noteText = visit.notes ?? '';
    row.loadingVisit = true;
    this.cdr.detectChanges();
    try {
      row.checklist = await this.supabase.getChecklist(visit.id);
      // Sincronizar status: si hay fecha real, recalcular y persistir si cambió
      if (visit.real_date) {
        const computed = this.computeVisitStatus(visit, row.checklist);
        if (computed !== visit.status) {
          visit.status = computed;
          await this.supabase.updateVisitStatus(visit.id, computed);
        }
      }
    } finally {
      row.loadingVisit = false;
      this.cdr.detectChanges();
    }
  }

  async toggleItem(item: ChecklistItem, row: PatientRow) {
    item.done = !item.done;
    this.cdr.detectChanges();
    await this.supabase.toggleChecklistItem(item.id, item.done);

    // Recalcular y persistir el estado de la visita si cambió
    const visit = row.selectedVisit;
    if (visit?.real_date) {
      const computed = this.computeVisitStatus(visit, row.checklist);
      if (computed !== visit.status) {
        visit.status = computed;
        this.cdr.detectChanges(); // chips se actualizan inmediatamente
        await this.supabase.updateVisitStatus(visit.id, computed);
      }
    }
  }

  async saveNote(row: PatientRow) {
    if (!row.selectedVisit) return;
    row.savingNote = true;
    this.cdr.detectChanges();
    await this.supabase.saveNote(row.selectedVisit.id, row.noteText);
    row.selectedVisit.notes = row.noteText;
    row.savingNote = false;
    this.cdr.detectChanges();
  }

  // ── Estado calculado ─────────────────────────────────

  /**
   * Estado visible de una visita para chips y badges.
   * Para visitas no realizadas lo deriva de la fecha estimada.
   * Para visitas realizadas devuelve el status en memoria
   * (que se mantiene sincronizado con la BD al seleccionar o togglear).
   */
  displayStatus(visit: Visit): string {
    if (visit.real_date) return visit.status;
    const now = Date.now();
    const daysUntil = (new Date(visit.estimated_date).getTime() - now) / 86_400_000;
    if (daysUntil > 7)  return 'futura';
    if (daysUntil >= 0) return 'proxima';
    return 'vencida';
  }

  /**
   * Calcula el estado correcto de una visita ya realizada.
   * Los plazos corren siempre desde real_date, nunca desde estimated_date.
   * No llamar si !visit.real_date.
   */
  private computeVisitStatus(visit: Visit, checklist: ChecklistItem[]): string {
    if (!visit.real_date) return this.displayStatus(visit); // guard de seguridad
    const now = Date.now();
    const pending = checklist.filter(i => !i.done);
    if (pending.length === 0) return 'completa';

    // El plazo corre desde la fecha REAL de realización, nunca desde la estimada
    const realMs = new Date(visit.real_date).getTime();
    const hasExpired = pending.some(i => {
      const p = this.resolvePlazo(i);
      return p !== null && realMs + p * 3_600_000 < now;
    });

    return hasExpired ? 'vencida' : 'realizada';
  }

  private resolvePlazo(item: ChecklistItem): number | null {
    if (item.plazo_horas != null) return item.plazo_horas;
    switch (item.deadline) {
      case 'inmediato': return 0;
      case '48hs':      return 48;
      case '7dias':     return 168;
      default:          return null;
    }
  }

  // ── Helpers de presentación ──────────────────────────

  groupedChecklist(checklist: ChecklistItem[]): ChecklistGroup[] {
    const groups: Record<string, ChecklistGroup> = {
      inmediato: { label: 'Al momento de la visita', items: [] },
      '48hs':    { label: 'Dentro de 48 hs', items: [] },
      '7dias':   { label: 'Hasta 7 días', items: [] },
    };
    for (const item of checklist) {
      groups[item.deadline]?.items.push(item);
    }
    return Object.values(groups).filter(g => g.items.length > 0);
  }

  /**
   * Badge label contextual:
   * - 'vencida' sin real_date → la ventana de la visita pasó sin realizarse → "Vencida"
   * - 'vencida' con real_date → ítems con plazo vencido tras la visita → "Lab pend."
   */
  visitBadgeLabel(visit: Visit): string {
    const status = this.displayStatus(visit);
    if (status === 'vencida') {
      return visit.real_date ? 'Lab pend.' : 'Vencida';
    }
    const map: Record<string, string> = {
      futura: 'Futura', proxima: 'Próxima', realizada: 'Realizada', completa: 'Completa',
    };
    return map[status] ?? status;
  }

  /**
   * Fecha límite de la ventana de completado del checklist:
   * real_date + plazo máximo de los ítems.
   * Devuelve '—' si la visita no fue realizada o no tiene ítems.
   */
  visitWindowEnd(visit: Visit, checklist: ChecklistItem[]): string {
    if (!visit.real_date || checklist.length === 0) return '—';
    const maxPlazo = checklist.reduce((max, i) => Math.max(max, this.resolvePlazo(i) ?? 0), 0);
    const endMs = new Date(visit.real_date).getTime() + maxPlazo * 3_600_000;
    return this.fmtDate(new Date(endMs).toISOString().slice(0, 10));
  }

  badgeLabel(status: string): string {
    const map: Record<string, string> = {
      futura: 'Futura', proxima: 'Próxima', realizada: 'Realizada',
      vencida: 'Lab pend.', completa: 'Completa',
    };
    return map[status] ?? status;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      futura: 'Futura', proxima: 'Próxima', realizada: 'Realizada',
      vencida: 'Ítems vencidos', completa: 'Completa',
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
