import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Patient, Visit } from '../supabase.service';

@Component({
  selector: 'app-registro-visita-panel',
  host: { style: 'display:block' },
  imports: [FormsModule],
  templateUrl: './registro-visita-panel.html',
})
export class RegistroVisitaPanelComponent implements OnChanges {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();

  patients: Patient[] = [];
  loading = signal(false);
  searchText = '';
  showDropdown = false;
  selectedPatient: Patient | null = null;
  visits: Visit[] = [];
  registerDates: Record<string, string> = {};
  saving: Record<string, boolean> = {};
  saved: Record<string, boolean> = {};

  constructor(private supabase: SupabaseService, private cdr: ChangeDetectorRef) {}

  async ngOnChanges(c: SimpleChanges) {
    if (c['visible']?.currentValue === true && this.patients.length === 0) {
      this.loading.set(true);
      try {
        this.patients = await this.supabase.getAllPatients();
      } finally {
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    }
  }

  get filteredPatients(): Patient[] {
    if (!this.searchText.trim()) return [];
    const q = this.searchText.toLowerCase();
    return this.patients.filter(p =>
      p.id.toLowerCase().includes(q) || p.full_name.toLowerCase().includes(q)
    ).slice(0, 8);
  }

  onSearchInput() {
    this.showDropdown = true;
    this.selectedPatient = null;
  }

  async selectPatient(patient: Patient) {
    this.selectedPatient = patient;
    this.searchText = patient.full_name;
    this.showDropdown = false;
    this.visits = await this.supabase.getVisits(patient.id);
    this.registerDates = {};
    this.saving = {};
    this.saved = {};
    this.cdr.detectChanges();
  }

  pendingVisits(): Visit[] {
    return this.visits.filter(v => !v.real_date);
  }

  async saveDate(visit: Visit) {
    const date = this.registerDates[visit.id];
    if (!date) return;
    this.saving[visit.id] = true;
    this.cdr.detectChanges();
    try {
      await this.supabase.updateVisitStatus(visit.id, 'realizada', date);
      visit.real_date = date;
      this.saved[visit.id] = true;
    } finally {
      this.saving[visit.id] = false;
      this.cdr.detectChanges();
    }
  }

  close() {
    this.selectedPatient = null;
    this.searchText = '';
    this.showDropdown = false;
    this.visits = [];
    this.registerDates = {};
    this.saved = {};
    this.closed.emit();
  }

  fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y.slice(2)}`;
  }
}
