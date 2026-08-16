import { Component, OnInit, OnDestroy, signal, computed, DestroyRef, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '../../core/services/alert.service';
import { SocketService } from '../../core/services/socket.service';
import { ToastService } from '../../core/services/toast.service';
import { Alert } from '../../core/models/alert.model';
import { environment } from '../../../environments/environment';
import * as L from 'leaflet';

@Component({
  selector: 'app-admin-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-monitor.html'
})
export class AdminMonitorComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  mediaUrl = environment.mediaUrl;

  alerts = signal<Alert[]>([]);
  isLoading = signal(true);
  isRefreshing = signal(false);

  // Computed counters
  readonly emergenciesCount = computed(() => 
    this.alerts().filter(a => a.tipo_incidencia === 'Emergencia').length
  );

  readonly nonEmergenciesCount = computed(() => 
    this.alerts().length - this.emergenciesCount()
  );

  // Modal states
  showDetailsModal = signal(false);
  showMapModal = signal(false);
  selectedAlert = signal<Alert | null>(null);

  private mapInstance: L.Map | null = null;
  private mapTimeoutId: any = null;

  constructor(
    private alertService: AlertService,
    private socketService: SocketService,
    private toastService: ToastService
  ) {}

  @HostListener('document:keydown.escape')
  onEscapePress() {
    if (this.showDetailsModal()) this.closeDetailsModal();
    if (this.showMapModal()) this.closeMapModal();
  }

  ngOnInit() {
    this.loadAlerts();
    this.socketService.joinOperators();

    this.socketService.onNewAlert()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((newAlert) => {
        this.alerts.update(currentAlerts => [newAlert, ...currentAlerts]);
      });

    this.socketService.onAlertStatusUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.alerts.update(currentAlerts => 
          currentAlerts.map(a => a.id === data.id ? { ...a, estado: data.estado } : a)
        );
        const currentSelected = this.selectedAlert();
        if (currentSelected && currentSelected.id === data.id) {
          this.selectedAlert.set({ ...currentSelected, estado: data.estado });
        }
      });
  }

  ngOnDestroy() {
    if (this.mapTimeoutId) clearTimeout(this.mapTimeoutId);
    this.cleanupMap();
  }

  private cleanupMap() {
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
  }

  loadAlerts() {
    this.isRefreshing.set(true);
    this.alertService.getAlertas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.alerts.set(res);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.isRefreshing.set(false);
          this.toastService.show('Error al cargar alertas del servidor.', 'error');
        }
      });
  }

  onEstadoChange(alertId: number, event: Event) {
    const select = event.target as HTMLSelectElement;
    const nuevoEstado = select.value;
    if (!nuevoEstado) return;

    this.alertService.updateEstadoAlerta(alertId, nuevoEstado)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.show(`Alerta #${alertId} actualizada a: ${nuevoEstado}`, 'success');
        },
        error: (err) => {
          this.toastService.show(err.error?.message || 'Error al actualizar estado.', 'error');
        }
      });
  }

  verDetalles(alert: Alert) {
    this.selectedAlert.set(alert);
    this.showDetailsModal.set(true);
  }

  closeDetailsModal() {
    this.showDetailsModal.set(false);
  }

  verMapa(alert: Alert) {
    this.selectedAlert.set(alert);
    this.showMapModal.set(true);
    
    if (this.mapTimeoutId) clearTimeout(this.mapTimeoutId);
    this.mapTimeoutId = setTimeout(() => {
      this.initMap(alert);
    }, 100);
  }

  closeMapModal() {
    this.cleanupMap();
    this.showMapModal.set(false);
  }

  private initMap(alert: Alert) {
    this.cleanupMap();

    try {
      const lat = Number(alert.latitud);
      const lng = Number(alert.longitud);

      this.mapInstance = L.map('map', {
        zoomControl: true,
        fadeAnimation: true
      }).setView([lat, lng], 15);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap contributors © CARTO'
      }).addTo(this.mapInstance);

      this.mapInstance.invalidateSize();

      const customIcon = L.divIcon({
        html: `
          <div class="flex items-center justify-center relative">
            <div class="absolute w-8 h-8 rounded-full bg-red-500/30 animate-ping"></div>
            <div class="relative w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 to-rose-700 border-2 border-white shadow-lg flex items-center justify-center text-white">
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              </svg>
            </div>
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([lat, lng], { icon: customIcon })
        .addTo(this.mapInstance)
        .bindPopup(`<div class="text-slate-900 font-sans p-1 text-xs">
          <b class="text-sm block mb-1 text-indigo-600 font-bold">${alert.tipo_incidencia}</b>
          <b>Vecino:</b> ${alert.usuario_nombre}<br>
          <b>DNI:</b> ${alert.usuario_dni}
        </div>`)
        .openPopup();
    } catch (error) {
      console.error('Error initializing Leaflet map:', error);
    }
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

  isSameInstant(dateStr1: string, dateStr2: string): boolean {
    const d1 = new Date(dateStr1).getTime();
    const d2 = new Date(dateStr2).getTime();
    return Math.abs(d1 - d2) < 5000;
  }
}
