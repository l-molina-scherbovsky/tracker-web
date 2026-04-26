import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SupabaseService, Protocol } from './supabase.service';
import { FabComponent } from './fab/fab';
import { RegistroVisitaPanelComponent } from './registro-visita-panel/registro-visita-panel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FabComponent, RegistroVisitaPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protocols: Protocol[] = [];
  showRegistroPanel = signal(false);

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    try {
      this.protocols = await this.supabase.getProtocols();
    } catch {}
  }
}
