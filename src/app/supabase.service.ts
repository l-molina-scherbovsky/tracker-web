import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

export interface Protocol { id: string; name: string; }
export interface Patient { id: string; protocol_id: string; initials: string; full_name: string; coordinator: string; status: string; }
export interface Visit { id: string; patient_id: string; label: string; type: string; estimated_date: string; real_date?: string; status: string; notes?: string; sort_order: number; }
export interface ChecklistItem { id: string; visit_id: string; label: string; deadline: string; done: boolean; plazo_horas?: number; }

export interface VisitDefinition {
  id: string;
  protocol_id: string;
  visit_code: string;
  visit_type: string;
  date_mode: string;
  offset_days: number;
  window_days: number;
  sort_order: number;
}

export interface ChecklistItemDef {
  id: string;
  visit_definition_id: string;
  name: string;
  plazo_horas: number;
  sort_order: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  visit_type: string;
  is_global: boolean;
  protocol_id: string | null;
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  name: string;
  plazo_horas: number;
  obligatorio: boolean;
  sort_order: number;
}

export interface PatientVisit {
  id: string;
  patient_id: string;
  visit_definition_id: string;
  estimated_date: string;
  actual_date?: string;
  window_start?: string;
  window_end?: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async getProtocols(): Promise<Protocol[]> {
    const { data, error } = await this.client.from('protocols').select('*').order('id');
    if (error) throw error;
    return data ?? [];
  }

  async getPatients(protocolId: string): Promise<Patient[]> {
    const { data, error } = await this.client
      .from('patients').select('*').eq('protocol_id', protocolId).order('id');
    if (error) throw error;
    return data ?? [];
  }

  async getPatient(patientId: string): Promise<Patient | null> {
    const { data, error } = await this.client
      .from('patients').select('*').eq('id', patientId).single();
    if (error) throw error;
    return data;
  }

  async getVisits(patientId: string): Promise<Visit[]> {
    const { data, error } = await this.client
      .from('visits').select('*').eq('patient_id', patientId).order('sort_order');
    if (error) throw error;
    return data ?? [];
  }

  async getChecklist(visitId: string): Promise<ChecklistItem[]> {
    const { data, error } = await this.client
      .from('checklist_items').select('*').eq('visit_id', visitId).order('deadline');
    if (error) throw error;
    return data ?? [];
  }

  async toggleChecklistItem(itemId: string, done: boolean): Promise<void> {
    const { error } = await this.client
      .from('checklist_items').update({ done }).eq('id', itemId);
    if (error) throw error;
  }

  async updateVisitStatus(visitId: string, status: string, realDate?: string): Promise<void> {
    const { error } = await this.client
      .from('visits').update({ status, real_date: realDate }).eq('id', visitId);
    if (error) throw error;
  }

  async saveNote(visitId: string, notes: string): Promise<void> {
    const { error } = await this.client
      .from('visits').update({ notes }).eq('id', visitId);
    if (error) throw error;
  }

  async getAllPatients(): Promise<Patient[]> {
    const { data, error } = await this.client.from('patients').select('*').order('id');
    if (error) throw error;
    return data ?? [];
  }

  async getAllVisits(): Promise<Visit[]> {
    const { data, error } = await this.client.from('visits').select('*');
    if (error) throw error;
    return data ?? [];
  }

  async getAllChecklistItems(): Promise<ChecklistItem[]> {
    const { data, error } = await this.client.from('checklist_items').select('*');
    if (error) throw error;
    return data ?? [];
  }

  // ── Protocol CRUD ────────────────────────────────────

  async createProtocol(id: string, name: string): Promise<Protocol> {
    const { data, error } = await this.client.from('protocols').insert({ id, name }).select().single();
    if (error) throw error;
    return data;
  }

  async updateProtocol(id: string, name: string): Promise<void> {
    const { error } = await this.client.from('protocols').update({ name }).eq('id', id);
    if (error) throw error;
  }

  // ── VisitDefinition CRUD ─────────────────────────────

  async getVisitDefinitions(protocolId: string): Promise<VisitDefinition[]> {
    const { data, error } = await this.client
      .from('visit_definitions').select('*').eq('protocol_id', protocolId).order('sort_order');
    if (error) throw error;
    return data ?? [];
  }

  async createVisitDefinition(def: Omit<VisitDefinition, 'id'>): Promise<VisitDefinition> {
    const { data, error } = await this.client.from('visit_definitions').insert(def).select().single();
    if (error) throw error;
    return data;
  }

  async updateVisitDefinition(id: string, updates: Partial<Omit<VisitDefinition, 'id'>>): Promise<void> {
    const { error } = await this.client.from('visit_definitions').update(updates).eq('id', id);
    if (error) throw error;
  }

  async deleteVisitDefinition(id: string): Promise<void> {
    const { error } = await this.client.from('visit_definitions').delete().eq('id', id);
    if (error) throw error;
  }

  // ── ChecklistItemDef CRUD ────────────────────────────

  async getChecklistItemDefs(visitDefinitionId: string): Promise<ChecklistItemDef[]> {
    const { data, error } = await this.client
      .from('checklist_item_defs').select('*').eq('visit_definition_id', visitDefinitionId).order('sort_order');
    if (error) throw error;
    return data ?? [];
  }

  async createChecklistItemDef(item: Omit<ChecklistItemDef, 'id'>): Promise<ChecklistItemDef> {
    const { data, error } = await this.client.from('checklist_item_defs').insert(item).select().single();
    if (error) throw error;
    return data;
  }

  async updateChecklistItemDef(id: string, updates: Partial<Omit<ChecklistItemDef, 'id'>>): Promise<void> {
    const { error } = await this.client.from('checklist_item_defs').update(updates).eq('id', id);
    if (error) throw error;
  }

  async deleteChecklistItemDef(id: string): Promise<void> {
    const { error } = await this.client.from('checklist_item_defs').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Patient / Visit creation ─────────────────────────

  async createPatient(p: { id: string; protocol_id: string; initials: string; full_name: string; coordinator: string; status: string }): Promise<Patient> {
    const { data, error } = await this.client.from('patients').insert(p).select().single();
    if (error) throw error;
    return data;
  }

  async createVisit(v: Omit<Visit, 'id'>): Promise<Visit> {
    const { data, error } = await this.client.from('visits').insert(v).select().single();
    if (error) throw error;
    return data;
  }

  async createChecklistItem(item: Omit<ChecklistItem, 'id'>): Promise<ChecklistItem> {
    const { data, error } = await this.client.from('checklist_items').insert(item).select().single();
    if (error) throw error;
    return data;
  }

  // ── ChecklistTemplate CRUD ──────────────────────────

  async getProtocolTemplates(protocolId: string): Promise<ChecklistTemplate[]> {
    const { data, error } = await this.client
      .from('checklist_templates').select('*')
      .eq('protocol_id', protocolId).eq('is_global', false)
      .order('visit_type');
    if (error) throw error;
    return data ?? [];
  }

  async copyGlobalTemplatesToProtocol(protocolId: string): Promise<void> {
    const globals = await this.getGlobalTemplates();
    for (const g of globals) {
      const items = await this.getTemplateItems(g.id);
      const { data, error } = await this.client
        .from('checklist_templates')
        .insert({ name: g.name, visit_type: g.visit_type, is_global: false, protocol_id: protocolId })
        .select().single();
      if (error) throw error;
      for (const item of items) {
        const { error: e2 } = await this.client.from('checklist_template_items').insert({
          template_id: data.id, name: item.name,
          plazo_horas: item.plazo_horas, obligatorio: item.obligatorio, sort_order: item.sort_order,
        });
        if (e2) throw e2;
      }
    }
  }

  // ── ChecklistTemplate CRUD ───────────────────────────

  async getGlobalTemplates(): Promise<ChecklistTemplate[]> {
    const { data, error } = await this.client
      .from('checklist_templates').select('*').eq('is_global', true).order('visit_type');
    if (error) throw error;
    return data ?? [];
  }

  async getTemplateItems(templateId: string): Promise<ChecklistTemplateItem[]> {
    const { data, error } = await this.client
      .from('checklist_template_items').select('*').eq('template_id', templateId).order('sort_order');
    if (error) throw error;
    return data ?? [];
  }

  async createTemplateItem(item: Omit<ChecklistTemplateItem, 'id'>): Promise<ChecklistTemplateItem> {
    const { data, error } = await this.client.from('checklist_template_items').insert(item).select().single();
    if (error) throw error;
    return data;
  }

  async updateTemplateItem(id: string, updates: Partial<Omit<ChecklistTemplateItem, 'id'>>): Promise<void> {
    const { error } = await this.client.from('checklist_template_items').update(updates).eq('id', id);
    if (error) throw error;
  }

  async deleteTemplateItem(id: string): Promise<void> {
    const { error } = await this.client.from('checklist_template_items').delete().eq('id', id);
    if (error) throw error;
  }

  // ── PatientVisit (new schema) ─────────────────────────

  async createPatientVisit(v: Omit<PatientVisit, 'id'>): Promise<PatientVisit> {
    const { data, error } = await this.client.from('patient_visits').insert(v).select().single();
    if (error) throw error;
    return data;
  }
}
