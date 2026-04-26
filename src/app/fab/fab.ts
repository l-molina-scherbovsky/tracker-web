import { Component, Output, EventEmitter, HostListener } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-fab',
  templateUrl: './fab.html',
})
export class FabComponent {
  @Output() registrarVisita = new EventEmitter<void>();
  open = false;

  constructor(private router: Router) {}

  toggle(e: Event) {
    e.stopPropagation();
    this.open = !this.open;
  }

  @HostListener('document:click')
  onDocClick() { this.open = false; }

  goNuevoProtocolo() {
    this.open = false;
    this.router.navigate(['/protocolos/nuevo']);
  }

  goNuevoPaciente() {
    this.open = false;
    this.router.navigate(['/pacientes/nuevo']);
  }

  onRegistrarVisita() {
    this.open = false;
    this.registrarVisita.emit();
  }
}
