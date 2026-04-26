import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService, Protocol, VisitDefinition, ChecklistItemDef } from '../supabase.service';

interface VisitPreview {
  def: VisitDefinition;
  estimatedDate: string;
  windowStart: string;
  windowEnd: string;
}

@Component({
  selector: 'app-paciente-nuevo',
  imports: [FormsModule, RouterLink],
  templateUrl: './paciente-nuevo.html',
})
export class PacienteNuevo implements OnInit {
  protocols: Protocol[] = [];
  visitDefs: VisitDefinition[] = [];
  visitPreviews: VisitPreview[] = [];
  checklistByDef: Record<string, ChecklistItemDef[]> = {};

  patientId = '';
  fullName = '';
  selectedProtocolId = '';
  coordinator = '';
  inclusionDate = '';
  status = 'Activo';

  saving = false;
  error = '';
  loadingDefs = false;

  readonly coordinators = ['Ana Torres', 'María López', 'Carlos Ruiz'];
  readonly statusOptions = ['Activo', 'Falla de selección'];

  constructor(private supabase: SupabaseService, private router: Router) {}

  async ngOnInit() {
    this.protocols = await this.supabase.getProtocols();
  }

  get initials(): string {
    return this.fullName
      .split(' ')
      .filter(w => w)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  async onProtocolChange() {
    if (!this.selectedProtocolId) { this.visitDefs = []; this.visitPreviews = []; return; }
    this.loadingDefs = true;
    try {
      this.visitDefs = await this.supabase.getVisitDefinitions(this.selectedProtocolId);
      this.buildPreviews();
    } finally {
      this.loadingDefs = false;
    }
  }

  onInclusionDateChange() { this.buildPreviews(); }

  private buildPreviews() {
    if (!this.inclusionDate || this.visitDefs.length === 0) { this.visitPreviews = []; return; }
    const base = new Date(this.inclusionDate);
    this.visitPreviews = this.visitDefs.map(def => {
      const est = new Date(base);
      est.setDate(base.getDate() + def.offset_days);
      const half = Math.floor(def.window_days / 2);
      const ws = new Date(est); ws.setDate(est.getDate() - half);
      const we = new Date(est); we.setDate(est.getDate() + half);
      return {
        def,
        estimatedDate: est.toISOString().slice(0, 10),
        windowStart:   ws.toISOString().slice(0, 10),
        windowEnd:     we.toISOString().slice(0, 10),
      };
    });
  }

  canSave(): boolean {
    return !!(this.patientId.trim() && this.fullName.trim() && this.selectedProtocolId && this.coordinator);
  }

  private plazoToDeadline(plazo: number): string {
    if (plazo === 0) return 'inmediato';
    if (plazo <= 48) return '48hs';
    return '7dias';
  }

  async save() {
    if (!this.canSave()) return;
    this.saving = true;
    this.error = '';
    try {
      await this.supabase.createPatient({
        id:          this.patientId.trim(),
        protocol_id: this.selectedProtocolId,
        initials:    this.initials,
        full_name:   this.fullName.trim(),
        coordinator: this.coordinator,
        status:      this.status,
      });

      for (const preview of this.visitPreviews) {
        const visit = await this.supabase.createVisit({
          patient_id:     this.patientId.trim(),
          label:          preview.def.visit_code,
          type:           preview.def.visit_type,
          estimated_date: preview.estimatedDate,
          status:         'futura',
          sort_order:     preview.def.sort_order,
        });

        const items = this.checklistByDef[preview.def.id]
          ?? (this.checklistByDef[preview.def.id] = await this.supabase.getChecklistItemDefs(preview.def.id));
        for (const item of items) {
          await this.supabase.createChecklistItem({
            visit_id:    visit.id,
            label:       item.name,
            deadline:    this.plazoToDeadline(item.plazo_horas),
            done:        false,
            plazo_horas: item.plazo_horas,
          });
        }

        await this.supabase.createPatientVisit({
          patient_id:          this.patientId.trim(),
          visit_definition_id: preview.def.id,
          estimated_date:      preview.estimatedDate,
          window_start:        preview.windowStart,
          window_end:          preview.windowEnd,
        });
      }

      this.router.navigate(['/protocol', this.selectedProtocolId]);
    } catch (e: any) {
      this.error = e?.message ?? JSON.stringify(e);
      this.saving = false;
    }
  }

  fmtDate(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y.slice(2)}`;
  }
}
