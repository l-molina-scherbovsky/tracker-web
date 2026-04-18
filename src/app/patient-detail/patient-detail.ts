import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Patient, Visit, ChecklistItem } from '../supabase.service';

interface ChecklistGroup { label: string; items: ChecklistItem[]; }

@Component({
  selector: 'app-patient-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './patient-detail.html',
})
export class PatientDetail implements OnInit {
  protocolId = '';
  patient: Patient | null = null;
  visits: Visit[] = [];
  selectedVisit: Visit | null = null;
  checklist: ChecklistItem[] = [];
  loading = true;
  savingNote = false;
  noteText = '';

  constructor(private route: ActivatedRoute, private supabase: SupabaseService) {}

  async ngOnInit() {
    this.protocolId = this.route.snapshot.paramMap.get('protocolId') ?? '';
    const patientId = this.route.snapshot.paramMap.get('patientId') ?? '';
    try {
      this.patient = await this.supabase.getPatient(patientId);
      this.visits = await this.supabase.getVisits(patientId);
      if (this.visits.length > 0) await this.selectVisit(this.visits[0]);
    } finally {
      this.loading = false;
    }
  }

  async selectVisit(visit: Visit) {
    this.selectedVisit = visit;
    this.noteText = visit.notes ?? '';
    this.checklist = await this.supabase.getChecklist(visit.id);
  }

  async toggleItem(item: ChecklistItem) {
    item.done = !item.done;
    await this.supabase.toggleChecklistItem(item.id, item.done);
  }

  async saveNote() {
    if (!this.selectedVisit) return;
    this.savingNote = true;
    await this.supabase.saveNote(this.selectedVisit.id, this.noteText);
    this.selectedVisit.notes = this.noteText;
    this.savingNote = false;
  }

  get grouped(): ChecklistGroup[] {
    const groups: Record<string, ChecklistGroup> = {
      inmediato: { label: 'Al momento de la visita', items: [] },
      '48hs':    { label: 'Dentro de 48 hs', items: [] },
      '7dias':   { label: 'Hasta 7 días', items: [] },
    };
    for (const item of this.checklist) {
      groups[item.deadline]?.items.push(item);
    }
    return Object.values(groups).filter(g => g.items.length > 0);
  }

  chipClass(status: string): string {
    const base = 'inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold min-w-[44px] cursor-pointer border ';
    switch (status) {
      case 'futura':    return base + 'bg-gray-100 text-gray-500 border-gray-200';
      case 'proxima':   return base + 'bg-blue-100 text-blue-700 border-blue-200';
      case 'realizada': return base + 'bg-green-100 text-green-700 border-green-300';
      case 'vencida':   return base + 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'completa':  return base + 'bg-green-500 text-white border-green-600';
      default:          return base + 'bg-gray-100 text-gray-500 border-gray-200';
    }
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      futura: 'Futura', proxima: 'Próxima', realizada: 'Realizada',
      vencida: 'Ítems vencidos', completa: 'Completa',
    };
    return map[status] ?? status;
  }
}
