import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

export interface Protocol { id: string; name: string; }
export interface Patient { id: string; protocol_id: string; initials: string; coordinator: string; status: string; }
export interface Visit { id: string; patient_id: string; label: string; type: string; estimated_date: string; real_date?: string; status: string; notes?: string; sort_order: number; }
export interface ChecklistItem { id: string; visit_id: string; label: string; deadline: string; done: boolean; }

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
}
