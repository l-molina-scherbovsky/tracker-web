import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Patient, Visit, VisitDefinition, ChecklistItemDef, ChecklistTemplateItem } from '../supabase.service';
import { PatientDetailPanelComponent } from '../patient-detail-panel/patient-detail-panel';

interface PatientRow { patient: Patient; visits: Visit[]; expanded: boolean; }

interface EditChecklistItem { id?: string; name: string; plazo_horas: number; deleted: boolean; }

interface EditTemplateItem {
  id?: string;
  name: string;
  plazo_horas: number;
  obligatorio: boolean;
  deleted: boolean;
  editingName: boolean;
  editName: string;
  showPlazoPicker: boolean;
}

interface TemplatePanel {
  templateId: string;
  visitType: string;
  items: EditTemplateItem[];
  adding: boolean;
  newName: string;
  newPlazo: number;
  newObligatorio: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
}
interface EditVisitDef {
  id?: string;
  visit_code: string;
  visit_type: string;
  offset_days: number;
  window_days: number;
  sort_order: number;
  expanded: boolean;
  deleted: boolean;
  checklistItems: EditChecklistItem[];
  loadingChecklist: boolean;
}

@Component({
  selector: 'app-protocol-detail',
  imports: [RouterLink, FormsModule, PatientDetailPanelComponent],
  templateUrl: './protocol-detail.html',
})
export class ProtocolDetail implements OnInit {
  protocolId = '';
  protocolName = '';
  rows: PatientRow[] = [];
  filtered: PatientRow[] = [];
  selectedCoordinator = 'Todos';
  loading = signal(true);
  error = signal('');

  // Edit mode
  editMode = false;
  editTab: 'general' | 'visitas' | 'plantilla' | 'pacientes' = 'general';
  editName = '';
  editVisitDefs: EditVisitDef[] = [];
  loadingDefs = false;
  savingEdit = false;
  editError = '';

  // Template panels (Tab 3)
  templatePanels: TemplatePanel[] = [];
  loadingTemplates = false;
  templateLoadError = '';

  readonly visitTypeOptions = [
    { value: 'VP', label: 'Visita presencial' },
    { value: 'CT', label: 'Contacto telefónico' },
  ];

  readonly plazos = [
    { value: 0,   label: 'Inmediato' },
    { value: 48,  label: '48 hs' },
    { value: 168, label: '7 días' },
  ];

  readonly plazosTemplate = [
    { value: 0,   label: 'Al momento' },
    { value: 48,  label: '48 hs' },
    { value: 168, label: '7 dias' },
  ];

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
    const startInEditMode = this.route.snapshot.data['startInEditMode'] === true;
    try {
      const protocols = await this.supabase.getProtocols();
      this.protocolName = protocols.find(p => p.id === this.protocolId)?.name ?? this.protocolId;
      const patients = await this.supabase.getPatients(this.protocolId);
      const rows: PatientRow[] = [];
      for (const patient of patients) {
        const visits = await this.supabase.getVisits(patient.id);
        rows.push({ patient, visits, expanded: false });
      }
      this.rows = rows;
      this.applyFilter();
    } catch (e: any) {
      this.error.set(e?.message ?? JSON.stringify(e));
    } finally {
      this.loading.set(false);
    }
    if (startInEditMode && !this.error()) {
      const startTab = (this.route.snapshot.queryParamMap.get('tab') ?? 'general') as 'general' | 'visitas' | 'plantilla' | 'pacientes';
      await this.enterEditMode(startTab);
    }
  }

  applyFilter() {
    this.filtered = this.selectedCoordinator === 'Todos'
      ? this.rows
      : this.rows.filter(r => r.patient.coordinator === this.selectedCoordinator);
    this.cdr.detectChanges();
  }

  filterBy(coord: string) { this.selectedCoordinator = coord; this.applyFilter(); }

  togglePatient(row: PatientRow) { row.expanded = !row.expanded; this.cdr.detectChanges(); }

  displayStatus(visit: Visit): string {
    if (visit.real_date) return visit.status;
    const daysUntil = (new Date(visit.estimated_date).getTime() - Date.now()) / 86_400_000;
    if (daysUntil > 7)  return 'futura';
    if (daysUntil >= 0) return 'proxima';
    return 'vencida';
  }

  fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    if (d.length >= 10 && d[4] === '-') {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y.slice(2)}`;
    }
    return d;
  }

  private toDbVisitType(t: string): string {
    if (t === 'VP') return 'presencial';
    if (t === 'CT') return 'telefonica';
    return t;
  }

  // ── Edit mode ───────────────────────────────────────

  async enterEditMode(startTab: 'general' | 'visitas' | 'plantilla' | 'pacientes' = 'general') {
    this.editMode = true;
    this.editTab = startTab;
    this.editName = this.protocolName;
    this.editError = '';
    this.templatePanels = [];
    await Promise.all([this.loadVisitDefs(), this.loadProtocolTemplates()]);
  }

  exitEditMode() {
    this.editMode = false;
    this.editVisitDefs = [];
    this.templatePanels = [];
  }

  private async loadProtocolTemplates() {
    this.loadingTemplates = true;
    this.templateLoadError = '';
    this.cdr.detectChanges();
    try {
      console.log('[Tab3] Cargando plantillas para protocolId:', this.protocolId);

      let templates = await this.supabase.getProtocolTemplates(this.protocolId);
      console.log('[Tab3] Templates del protocolo (is_global=false):', templates);

      if (templates.length === 0) {
        console.log('[Tab3] Sin plantillas propias, copiando desde globales...');
        await this.supabase.copyGlobalTemplatesToProtocol(this.protocolId);
        templates = await this.supabase.getProtocolTemplates(this.protocolId);
        console.log('[Tab3] Templates después de copiar:', templates);
      }

      const panels: TemplatePanel[] = [];
      for (const t of templates) {
        const rawItems = await this.supabase.getTemplateItems(t.id);
        console.log(`[Tab3] Items de template ${t.id} (${t.visit_type}):`, rawItems);
        panels.push({
          templateId: t.id, visitType: t.visit_type,
          items: rawItems.map(i => ({
            id: i.id, name: i.name, plazo_horas: i.plazo_horas, obligatorio: i.obligatorio,
            deleted: false, editingName: false, editName: i.name, showPlazoPicker: false,
          })),
          adding: false, newName: '', newPlazo: 0, newObligatorio: true,
          saving: false, saved: false, error: '',
        });
      }
      this.templatePanels = panels;
      console.log('[Tab3] templatePanels finales:', this.templatePanels);
    } catch (e: any) {
      const msg = e?.message ?? JSON.stringify(e);
      console.error('[Tab3] Error cargando plantillas:', msg);
      this.templateLoadError = msg;
    } finally {
      this.loadingTemplates = false;
      this.cdr.detectChanges();
    }
  }

  private async loadVisitDefs() {
    this.loadingDefs = true;
    this.cdr.detectChanges();
    try {
      const defs = await this.supabase.getVisitDefinitions(this.protocolId);
      this.editVisitDefs = defs.map(d => ({
        id: d.id, visit_code: d.visit_code, visit_type: d.visit_type,
        offset_days: d.offset_days, window_days: d.window_days,
        sort_order: d.sort_order, expanded: false, deleted: false, checklistItems: [], loadingChecklist: false,
      }));
    } finally {
      this.loadingDefs = false;
      this.cdr.detectChanges();
    }
  }

  async toggleEditDef(def: EditVisitDef) {
    def.expanded = !def.expanded;
    if (def.expanded && def.id && def.checklistItems.length === 0) {
      def.loadingChecklist = true;
      this.cdr.detectChanges();
      const items = await this.supabase.getChecklistItemDefs(def.id);
      def.checklistItems = items.map(i => ({ id: i.id, name: i.name, plazo_horas: i.plazo_horas, deleted: false }));
      def.loadingChecklist = false;
      this.cdr.detectChanges();
    }
    this.cdr.detectChanges();
  }

  async addVisitDef(visitType: string = 'VP') {
    const dbType = this.toDbVisitType(visitType); // 'presencial' | 'telefonica'
    let preItems: EditChecklistItem[] = [];

    // Primary: protocol-specific template already loaded in templatePanels
    const tpl = this.templatePanels.find(p => p.visitType === dbType);
    if (tpl) {
      preItems = tpl.items.filter(i => !i.deleted).map(i => ({ name: i.name, plazo_horas: i.plazo_horas, deleted: false }));
      console.log('Plantilla encontrada para tipo:', dbType, preItems.length, 'ítems');
    } else {
      // Fallback: protocol has no own templates — read from global
      try {
        const globals = await this.supabase.getGlobalTemplates();
        const globalTpl = globals.find(t => t.visit_type === dbType);
        if (globalTpl) {
          const items = await this.supabase.getTemplateItems(globalTpl.id);
          preItems = items.map(i => ({ name: i.name, plazo_horas: i.plazo_horas, deleted: false }));
          console.log('Plantilla encontrada para tipo:', dbType, preItems.length, 'ítems (plantilla global)');
        } else {
          console.log('Plantilla encontrada para tipo:', dbType, 0, 'ítems (sin plantilla disponible)');
        }
      } catch (e: any) {
        console.error('[addVisitDef] Error cargando plantilla global de fallback:', e);
      }
    }

    const visitCode = `V${this.editVisitDefs.filter(d => !d.deleted).length + 1}`;
    this.editVisitDefs.push({
      visit_code: visitCode,
      visit_type: visitType, offset_days: 0, window_days: 7,
      sort_order: this.editVisitDefs.length,
      expanded: true, deleted: false,
      checklistItems: preItems,
      loadingChecklist: false,
    });
    console.log('Visita nueva creada con ítems:', visitCode, preItems.length);
    this.cdr.detectChanges();
  }

  addChecklistItem(def: EditVisitDef) {
    def.checklistItems.push({ name: '', plazo_horas: 48, deleted: false });
  }

  // ── Template panel methods (Tab 3) ──────────────────

  plazoLabel(hours: number): string {
    return this.plazosTemplate.find(p => p.value === hours)?.label ?? `${hours} hs`;
  }

  startEditTplName(item: EditTemplateItem) { item.editName = item.name; item.editingName = true; }
  commitEditTplName(item: EditTemplateItem) { if (item.editName.trim()) item.name = item.editName.trim(); item.editingName = false; }
  cancelEditTplName(item: EditTemplateItem) { item.editingName = false; }

  toggleTplPlazoPicker(item: EditTemplateItem) {
    const next = !item.showPlazoPicker;
    for (const p of this.templatePanels) for (const i of p.items) i.showPlazoPicker = false;
    item.showPlazoPicker = next;
  }

  selectTplPlazo(item: EditTemplateItem, value: number) { item.plazo_horas = value; item.showPlazoPicker = false; }

  startAddTplItem(panel: TemplatePanel) { panel.adding = true; panel.newName = ''; panel.newPlazo = 0; panel.newObligatorio = true; }
  cancelAddTplItem(panel: TemplatePanel) { panel.adding = false; }

  confirmAddTplItem(panel: TemplatePanel) {
    if (!panel.newName.trim()) return;
    panel.items.push({
      name: panel.newName.trim(), plazo_horas: panel.newPlazo, obligatorio: panel.newObligatorio,
      deleted: false, editingName: false, editName: panel.newName.trim(), showPlazoPicker: false,
    });
    panel.adding = false;
  }

  async saveTplPanel(panel: TemplatePanel) {
    panel.saving = true; panel.saved = false; panel.error = '';
    this.cdr.detectChanges();
    try {
      let order = 0;
      for (const item of panel.items) {
        if (item.deleted) {
          if (item.id) await this.supabase.deleteTemplateItem(item.id);
          continue;
        }
        if (item.id) {
          await this.supabase.updateTemplateItem(item.id, {
            name: item.name, plazo_horas: item.plazo_horas,
            obligatorio: item.obligatorio, sort_order: order,
          });
        } else {
          const created = await this.supabase.createTemplateItem({
            template_id: panel.templateId, name: item.name,
            plazo_horas: item.plazo_horas, obligatorio: item.obligatorio, sort_order: order,
          });
          item.id = created.id;
        }
        order++;
      }
      panel.items = panel.items.filter(i => !i.deleted);
      panel.saved = true;
      setTimeout(() => { panel.saved = false; this.cdr.detectChanges(); }, 2500);
    } catch (e: any) {
      panel.error = e?.message ?? JSON.stringify(e);
    } finally {
      panel.saving = false;
      this.cdr.detectChanges();
    }
  }

  async saveEdit() {
    this.savingEdit = true;
    this.editError = '';
    this.cdr.detectChanges();
    try {
      await this.supabase.updateProtocol(this.protocolId, this.editName.trim());
      this.protocolName = this.editName.trim();

      let order = 0;
      for (const def of this.editVisitDefs) {
        if (def.deleted) {
          if (def.id) await this.supabase.deleteVisitDefinition(def.id);
          continue;
        }
        if (def.id) {
          await this.supabase.updateVisitDefinition(def.id, {
            visit_code: def.visit_code, visit_type: this.toDbVisitType(def.visit_type),
            offset_days: def.offset_days, window_days: def.window_days, sort_order: order,
          });
        } else {
          const created = await this.supabase.createVisitDefinition({
            protocol_id: this.protocolId, visit_code: def.visit_code,
            visit_type: this.toDbVisitType(def.visit_type),
            offset_days: def.offset_days, window_days: def.window_days, sort_order: order,
          } as any);
          def.id = created.id;
        }
        let itemOrder = 0;
        for (const item of def.checklistItems) {
          if (item.deleted) {
            if (item.id) await this.supabase.deleteChecklistItemDef(item.id);
            continue;
          }
          if (item.name.trim() === '') continue;
          if (item.id) {
            await this.supabase.updateChecklistItemDef(item.id, { name: item.name, plazo_horas: item.plazo_horas, sort_order: itemOrder });
          } else {
            await this.supabase.createChecklistItemDef({ visit_definition_id: def.id!, name: item.name, plazo_horas: item.plazo_horas, sort_order: itemOrder });
          }
          itemOrder++;
        }
        order++;
      }
      this.exitEditMode();
    } catch (e: any) {
      this.editError = e?.message ?? JSON.stringify(e);
    } finally {
      this.savingEdit = false;
      this.cdr.detectChanges();
    }
  }
}
