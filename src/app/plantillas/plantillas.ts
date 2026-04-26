import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService, ChecklistTemplate, ChecklistTemplateItem } from '../supabase.service';

interface EditItem {
  id?: string;
  name: string;
  plazo_horas: number;
  obligatorio: boolean;
  deleted: boolean;
  editingName: boolean;
  editName: string;
  showPlazoPicker: boolean;
}

interface Panel {
  template: ChecklistTemplate;
  items: EditItem[];
  adding: boolean;
  newName: string;
  newPlazo: number;
  newObligatorio: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
}

@Component({
  selector: 'app-plantillas',
  imports: [FormsModule],
  templateUrl: './plantillas.html',
})
export class Plantillas implements OnInit {
  loading = signal(true);
  loadError = signal('');
  panels: Panel[] = [];

  readonly plazos = [
    { value: 0,   label: 'Al momento' },
    { value: 48,  label: '48 hs' },
    { value: 168, label: '7 dias' },
  ];

  constructor(private supabase: SupabaseService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    try {
      const templates = await this.supabase.getGlobalTemplates();
      for (const t of templates) {
        const rawItems = await this.supabase.getTemplateItems(t.id);
        this.panels.push({
          template: t,
          items: rawItems.map(i => ({
            id: i.id,
            name: i.name,
            plazo_horas: i.plazo_horas,
            obligatorio: i.obligatorio,
            deleted: false,
            editingName: false,
            editName: i.name,
            showPlazoPicker: false,
          })),
          adding: false,
          newName: '',
          newPlazo: 0,
          newObligatorio: true,
          saving: false,
          saved: false,
          error: '',
        });
      }
    } catch (e: any) {
      this.loadError.set(e?.message ?? JSON.stringify(e));
    } finally {
      this.loading.set(false);
    }
  }

  plazoLabel(hours: number): string {
    return this.plazos.find(p => p.value === hours)?.label ?? `${hours} hs`;
  }

  startEditName(item: EditItem) {
    item.editName = item.name;
    item.editingName = true;
  }

  commitEditName(item: EditItem) {
    if (item.editName.trim()) item.name = item.editName.trim();
    item.editingName = false;
  }

  cancelEditName(item: EditItem) {
    item.editingName = false;
  }

  togglePlazoPicker(item: EditItem) {
    const next = !item.showPlazoPicker;
    for (const panel of this.panels)
      for (const i of panel.items) i.showPlazoPicker = false;
    item.showPlazoPicker = next;
  }

  selectPlazo(item: EditItem, value: number) {
    item.plazo_horas = value;
    item.showPlazoPicker = false;
  }

  startAdd(panel: Panel) {
    panel.adding = true;
    panel.newName = '';
    panel.newPlazo = 0;
    panel.newObligatorio = true;
  }

  cancelAdd(panel: Panel) { panel.adding = false; }

  confirmAdd(panel: Panel) {
    if (!panel.newName.trim()) return;
    panel.items.push({
      name: panel.newName.trim(),
      plazo_horas: panel.newPlazo,
      obligatorio: panel.newObligatorio,
      deleted: false,
      editingName: false,
      editName: panel.newName.trim(),
      showPlazoPicker: false,
    });
    panel.adding = false;
  }

  async save(panel: Panel) {
    panel.saving = true;
    panel.saved = false;
    panel.error = '';
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
            template_id: panel.template.id, name: item.name,
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
}
