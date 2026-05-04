import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { SupabaseService, Protocol } from './supabase.service';
import { FabComponent } from './fab/fab';
import { RegistroVisitaPanelComponent } from './registro-visita-panel/registro-visita-panel';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FabComponent, RegistroVisitaPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protocols = signal<Protocol[]>([]);
  showRegistroPanel = signal(false);
  showProtocolSubItems = signal(false);
  protocolsExpanded = signal(true);
  showAllProtocols = signal(false);

  constructor(private supabase: SupabaseService, private router: Router) {}

  async ngOnInit() {
    const isProtocolRoute = (url: string) =>
      url.startsWith('/protocolos') || url.startsWith('/protocol');

    this.showProtocolSubItems.set(isProtocolRoute(this.router.url));

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      this.showProtocolSubItems.set(isProtocolRoute((e as NavigationEnd).urlAfterRedirects));
    });

    try {
      this.protocols.set(await this.supabase.getProtocols());
    } catch {}
  }
}
