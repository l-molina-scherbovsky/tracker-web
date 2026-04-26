import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Visit, ChecklistItem } from '../supabase.service';

interface ChecklistGroup { label: string; items: ChecklistItem[]; }

@Component({
  selector: 'app-patient-detail-panel',
  host: { style: 'display:block' },
  imports: [FormsModule],
  templateUrl: './patient-detail-panel.html',
})
export class PatientDetailPanelComponent implements OnInit, OnChanges {
  @Input() patientId!: string;
  @Input() visitId?: string;

  visits: Visit[] = [];
  selectedVisit: Visit | null = null;
  checklist: ChecklistItem[] = [];
  noteText = '';
  savingNote = false;
  loadingVisit = false;
  loading = signal(true);
  registeringDate = false;
  newRealDate = '';
  savingDate = false;

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    await this.load();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['patientId'] && !changes['patientId'].firstChange) {
      await this.load();
    }
  }

  private async load() {
    this.loading.set(true);
    this.visits = [];
    this.selectedVisit = null;
    this.checklist = [];
    this.cdr.detectChanges();
    try {
      this.visits = await this.supabase.getVisits(this.patientId);
      const target = this.visitId
        ? (this.visits.find(v => v.id === this.visitId) ?? this.visits[0])
        : this.visits[0];
      if (target) await this.selectVisit(target);
    } finally {
      this.loading.set(false);
      this.cdr.detectChanges();
    }
  }

  async selectVisit(visit: Visit) {
    this.selectedVisit = visit;
    this.noteText = visit.notes ?? '';
    this.registeringDate = false;
    this.newRealDate = '';
    this.loadingVisit = true;
    this.cdr.detectChanges();
    try {
      this.checklist = await this.supabase.getChecklist(visit.id);
      if (visit.real_date) {
        const computed = this.computeVisitStatus(visit, this.checklist);
        if (computed !== visit.status) {
          visit.status = computed;
          await this.supabase.updateVisitStatus(visit.id, computed);
        }
      }
    } finally {
      this.loadingVisit = false;
      this.cdr.detectChanges();
    }
  }

  async toggleItem(item: ChecklistItem) {
    item.done = !item.done;
    this.cdr.detectChanges();
    await this.supabase.toggleChecklistItem(item.id, item.done);
    const visit = this.selectedVisit;
    if (visit?.real_date) {
      const computed = this.computeVisitStatus(visit, this.checklist);
      if (computed !== visit.status) {
        visit.status = computed;
        this.cdr.detectChanges();
        await this.supabase.updateVisitStatus(visit.id, computed);
      }
    }
  }

  async saveNote() {
    if (!this.selectedVisit) return;
    this.savingNote = true;
    this.cdr.detectChanges();
    await this.supabase.saveNote(this.selectedVisit.id, this.noteText);
    this.selectedVisit.notes = this.noteText;
    this.savingNote = false;
    this.cdr.detectChanges();
  }

  async saveDate() {
    if (!this.selectedVisit || !this.newRealDate) return;
    this.savingDate = true;
    this.cdr.detectChanges();
    try {
      await this.supabase.updateVisitStatus(this.selectedVisit.id, 'realizada', this.newRealDate);
      this.selectedVisit.real_date = this.newRealDate;
      this.selectedVisit.status = 'realizada';
      this.registeringDate = false;
      this.newRealDate = '';
      const computed = this.computeVisitStatus(this.selectedVisit, this.checklist);
      if (computed !== this.selectedVisit.status) {
        this.selectedVisit.status = computed;
        await this.supabase.updateVisitStatus(this.selectedVisit.id, computed);
      }
    } finally {
      this.savingDate = false;
      this.cdr.detectChanges();
    }
  }

  displayStatus(visit: Visit): string {
    if (visit.real_date) return visit.status;
    const now = Date.now();
    const daysUntil = (new Date(visit.estimated_date).getTime() - now) / 86_400_000;
    if (daysUntil > 7)  return 'futura';
    if (daysUntil >= 0) return 'proxima';
    return 'vencida';
  }

  private computeVisitStatus(visit: Visit, checklist: ChecklistItem[]): string {
    if (!visit.real_date) return this.displayStatus(visit);
    const now = Date.now();
    const pending = checklist.filter(i => !i.done);
    if (pending.length === 0) return 'completa';
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

  visitBadgeLabel(visit: Visit): string {
    const status = this.displayStatus(visit);
    if (status === 'vencida') return visit.real_date ? 'Lab pend.' : 'Vencida';
    const map: Record<string, string> = {
      futura: 'Futura', proxima: 'Próxima', realizada: 'Realizada', completa: 'Completa',
    };
    return map[status] ?? status;
  }

  visitWindowEnd(visit: Visit, checklist: ChecklistItem[]): string {
    if (!visit.real_date || checklist.length === 0) return '—';
    const maxPlazo = checklist.reduce((max, i) => Math.max(max, this.resolvePlazo(i) ?? 0), 0);
    const endMs = new Date(visit.real_date).getTime() + maxPlazo * 3_600_000;
    return this.fmtDate(new Date(endMs).toISOString().slice(0, 10));
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
