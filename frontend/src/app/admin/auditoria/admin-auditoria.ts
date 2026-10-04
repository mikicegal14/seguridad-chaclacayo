import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionService, AuditLog } from '../../core/services/configuracion.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-auditoria.html'
})
export class AdminAuditoriaComponent implements OnInit {
  private configService = inject(ConfiguracionService);
  private toastService = inject(ToastService);

  logs = signal<AuditLog[]>([]);
  total = signal<number>(0);
  isLoading = signal<boolean>(true);

  // Filters
  filterResponsable = signal<string>('');
  filterAccion = signal<string>('');
  
  // Pagination
  currentPage = signal<number>(1);
  readonly pageSize = 20;

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  ngOnInit() {
    this.cargarLogs();
  }

  cargarLogs() {
    this.isLoading.set(true);
    const offset = (this.currentPage() - 1) * this.pageSize;

    this.configService.getAuditoria({
      responsable: this.filterResponsable().trim() || undefined,
      accion: this.filterAccion() || undefined,
      limit: this.pageSize,
      offset
    }).subscribe({
      next: (res) => {
        this.logs.set(res.logs);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastService.show('Error al cargar registros de auditoría.', 'error');
      }
    });
  }

  onSearch(event?: Event) {
    if (event) event.preventDefault();
    this.currentPage.set(1);
    this.cargarLogs();
  }

  limpiarFiltros() {
    this.filterResponsable.set('');
    this.filterAccion.set('');
    this.currentPage.set(1);
    this.cargarLogs();
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina < 1 || (nuevaPagina - 1) * this.pageSize >= this.total()) return;
    this.currentPage.set(nuevaPagina);
    this.cargarLogs();
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getAccionLabel(accion: string): string {
    switch (accion) {
      case 'LOGIN_COLABORADOR': return 'Acceso Colaborador OTP';
      case 'LOGIN_ADMIN': return 'Inicio Sesión Admin';
      case 'LLENAR_ACTA_INTERVENCION': return 'Acta de Intervención';
      case 'ACTUALIZAR_ESTADO_ALERTA': return 'Cambio Estado Alerta';
      case 'CREAR_OPERADOR': return 'Creación de Operador';
      case 'ELIMINAR_OPERADOR': return 'Eliminación de Operador';
      default: return accion;
    }
  }

  formatDetalles(detalles: any): string {
    if (!detalles) return '-';
    if (typeof detalles === 'string') return detalles;
    try {
      const keys = Object.keys(detalles);
      return keys.map(k => `${k}: ${detalles[k]}`).join(' | ');
    } catch {
      return JSON.stringify(detalles);
    }
  }
}
