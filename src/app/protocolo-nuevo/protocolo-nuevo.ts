import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService, ChecklistTemplateItem } from '../supabase.service';

interface EditChecklistItem { name: string; plazo_horas: number; }
interface EditVisitDef {
  visit_code: string;
  visit_type: string;
  offset_days: number;
  window_days: number;
  sort_order: number;
  expanded: boolean;
  checklistItems: EditChecklistItem[];
}

@Component({
  selector: 'app-protocolo-nuevo',
  imports: [FormsModule, RouterLink],
  templateUrl: './protocolo-nuevo.html',
})
export class ProtocoloNuevo implements OnInit {
  protocolId = '';
  protocolName = '';
  visitDefs: EditVisitDef[] = [];
  saving = false;
  error = '';
  loadingTemplates = false;

  private globalTplItems = new Map<string, ChecklistTemplateItem[]>();

  readonly visitTypeOptions = [
    { value: 'VP', label: 'Visita presencial' },
    { value: 'CT', label: 'Contacto telefónico' },
  ];

  readonly plazos = [
    { value: 0,   label: 'Inmediato' },
    { value: 48,  label: '48 hs' },
    { value: 168, label: '7 días' },
  ];

  constructor(private supabase: SupabaseService, private router: Router) {}

  async ngOnInit() {
    this.loadingTemplates = true;
    try {
      const templates = await this.supabase.getGlobalTemplates();
      for (const t of templates) {
        const items = await this.supabase.getTemplateItems(t.id);
        this.globalTplItems.set(t.visit_type, items);
      }
    } catch (e: any) {
      console.error('[ProtocoloNuevo] Error cargando plantillas globales:', e);
    } finally {
      this.loadingTemplates = false;
    }
  }

  private itemsForType(visitType: string): EditChecklistItem[] {
    const tplType = visitType === 'VP' ? 'presencial' : 'telefonica';
    return (this.globalTplItems.get(tplType) ?? []).map(i => ({ name: i.name, plazo_horas: i.plazo_horas }));
  }

  addVisit() {
    this.visitDefs.push({
      visit_code: `V${this.visitDefs.length + 1}`,
      visit_type: 'VP',
      offset_days: 0,
      window_days: 7,
      sort_order: this.visitDefs.length,
      expanded: true,
      checklistItems: this.itemsForType('VP'),
    });
  }

  removeVisit(i: number) { this.visitDefs.splice(i, 1); }

  addChecklistItem(def: EditVisitDef) {
    def.checklistItems.push({ name: '', plazo_horas: 48 });
  }

  removeChecklistItem(def: EditVisitDef, j: number) { def.checklistItems.splice(j, 1); }

  canSave(): boolean {
    return !this.saving && !!this.protocolId.trim() && !!this.protocolName.trim() && !this.loadingTemplates;
  }

  async save() {
    if (this.saving) return;  // guard contra doble click antes de que Angular re-renderice
    if (!this.canSave()) return;
    this.saving = true;
    this.error = '';
    const pid = this.protocolId.trim();

    try {
      // 1. Crear protocolo
      console.log('[ProtocoloNuevo] Creando protocolo:', pid);
      await this.supabase.createProtocol(pid, this.protocolName.trim());
      console.log('[ProtocoloNuevo] Protocolo creado:', pid);

      // 2. Crear visitas y sus checklist items
      console.log('[ProtocoloNuevo] Visitas a guardar:', this.visitDefs.length);
      for (let i = 0; i < this.visitDefs.length; i++) {
        const def = this.visitDefs[i];
        const visitPayload = {
          protocol_id: pid,
          visit_code:  def.visit_code,
          visit_type:  def.visit_type === 'VP' ? 'presencial' : 'telefonica',
          offset_days: def.offset_days,
          window_days: def.window_days,
          sort_order:  i,
        };
        console.log('[ProtocoloNuevo] INSERT visit_definition payload:', JSON.stringify(visitPayload));
        const created = await this.supabase.createVisitDefinition(visitPayload);
        console.log('[ProtocoloNuevo] Visita guardada:', created.id, '(', def.visit_code, ')');

        const itemsToSave = def.checklistItems.filter(item => item.name.trim());
        for (let j = 0; j < itemsToSave.length; j++) {
          await this.supabase.createChecklistItemDef({
            visit_definition_id: created.id,
            name:        itemsToSave[j].name.trim(),
            plazo_horas: Number(itemsToSave[j].plazo_horas),
            sort_order:  j,
          });
        }
        console.log('[ProtocoloNuevo] Items guardados para visita:', itemsToSave.length);
      }

      // 3. Copiar plantillas globales al protocolo (para Tab 3 en edición)
      //    Con timeout de 10s: si cuelga no bloqueamos la navegación
      console.log('[ProtocoloNuevo] Copiando plantillas globales al protocolo...');
      try {
        await Promise.race([
          this.supabase.copyGlobalTemplatesToProtocol(pid),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT_PLANTILLAS')), 10_000)
          ),
        ]);
        console.log('[ProtocoloNuevo] Plantillas copiadas.');
      } catch (te: any) {
        if (te?.message === 'TIMEOUT_PLANTILLAS') {
          console.warn('[ProtocoloNuevo] Timeout copiando plantillas. Navegando de todos modos.');
        } else {
          console.error('[ProtocoloNuevo] Error copiando plantillas:', te);
        }
        // No bloqueamos: protocolo y visitas ya fueron guardados
      }

      // 4. Navegar
      console.log('[ProtocoloNuevo] Navegando a /protocolos/' + pid + '/editar?tab=plantilla');
      await this.router.navigate(['/protocolos', pid, 'editar'], { queryParams: { tab: 'plantilla' } });

    } catch (e: any) {
      console.error('[ProtocoloNuevo] Error crítico en save():', e);
      this.error = e?.message ?? JSON.stringify(e);
    } finally {
      this.saving = false;
    }
  }
}
