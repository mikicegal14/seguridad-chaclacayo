import { Component, OnInit, OnDestroy, signal, computed, DestroyRef, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '../../core/services/alert.service';
import { SocketService } from '../../core/services/socket.service';
import { ToastService } from '../../core/services/toast.service';
import { Alert } from '../../core/models/alert.model';
import * as L from 'leaflet';

export interface Hotspot {
  name: string;
  lat: number;
  lng: number;
  count: number;
  breakdown: { [type: string]: number };
}

@Component({
  selector: 'app-admin-heatmap',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-heatmap.html',
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class AdminHeatmapComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroyRef = inject(DestroyRef);

  alerts = signal<Alert[]>([]);
  selectedTypeFilter = signal<string>('Todos');

  readonly hotspots = computed<Hotspot[]>(() => {
    const filterType = this.selectedTypeFilter();
    const alertList = this.alerts();
    const clusters: Hotspot[] = [];
    const CLUSTER_RADIUS_METERS = 50;

    for (const alert of alertList) {
      if (filterType !== 'Todos' && alert.tipo_incidencia !== filterType) {
        continue;
      }

      const alertLat = Number(alert.latitud);
      const alertLng = Number(alert.longitud);

      if (isNaN(alertLat) || isNaN(alertLng)) {
        continue;
      }

      let foundCluster = false;
      for (const spot of clusters) {
        const dist = this.getDistance(alertLat, alertLng, spot.lat, spot.lng);
        if (dist <= CLUSTER_RADIUS_METERS) {
          spot.count++;
          if (spot.breakdown[alert.tipo_incidencia] !== undefined) {
            spot.breakdown[alert.tipo_incidencia]++;
          } else {
            spot.breakdown[alert.tipo_incidencia] = 1;
          }
          spot.lat = (spot.lat * (spot.count - 1) + alertLat) / spot.count;
          spot.lng = (spot.lng * (spot.count - 1) + alertLng) / spot.count;
          spot.name = `Área [${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}]`;
          foundCluster = true;
          break;
        }
      }

      if (!foundCluster) {
        clusters.push({
          name: `Punto [${alertLat.toFixed(4)}, ${alertLng.toFixed(4)}]`,
          lat: alertLat,
          lng: alertLng,
          count: 1,
          breakdown: {
            'Asalto': alert.tipo_incidencia === 'Asalto' ? 1 : 0,
            'Emergencia': alert.tipo_incidencia === 'Emergencia' ? 1 : 0,
            'Accidente': alert.tipo_incidencia === 'Accidente' ? 1 : 0,
            'Vandalismo': alert.tipo_incidencia === 'Vandalismo' ? 1 : 0,
            'Otros': alert.tipo_incidencia === 'Otros' ? 1 : 0,
            'Reporte': alert.tipo_incidencia === 'Reporte' ? 1 : 0
          }
        });
      }
    }

    return clusters.sort((a, b) => b.count - a.count);
  });

  private heatmapInstance: L.Map | null = null;
  private circleLayers: L.LayerGroup | null = null;
  private heatmapTimeoutId: any = null;

  constructor(
    private alertService: AlertService,
    private socketService: SocketService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadAlerts();
    this.socketService.joinOperators();

    this.socketService.onNewAlert()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((newAlert) => {
        this.alerts.update(currentAlerts => [newAlert, ...currentAlerts]);
        this.updateHeatmapLayers();
      });

    this.socketService.onAlertStatusUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.alerts.update(currentAlerts => 
          currentAlerts.map(a => a.id === data.id ? { ...a, estado: data.estado } : a)
        );
        this.updateHeatmapLayers();
      });
  }

  ngAfterViewInit() {
    this.heatmapTimeoutId = setTimeout(() => {
      this.initHeatmap();
    }, 100);
  }

  ngOnDestroy() {
    if (this.heatmapTimeoutId) clearTimeout(this.heatmapTimeoutId);
    this.cleanupHeatmap();
  }

  private cleanupHeatmap() {
    if (this.heatmapInstance) {
      this.heatmapInstance.remove();
      this.heatmapInstance = null;
      this.circleLayers = null;
    }
  }

  loadAlerts() {
    this.alertService.getAlertas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.alerts.set(res);
          this.updateHeatmapLayers();
        },
        error: () => {
          this.toastService.show('Error al cargar datos para el mapa de calor.', 'error');
        }
      });
  }

  onFilterChange(newFilter: string) {
    this.selectedTypeFilter.set(newFilter);
    this.updateHeatmapLayers();
  }

  private initHeatmap() {
    this.cleanupHeatmap();

    try {
      // Center on Chaclacayo District
      this.heatmapInstance = L.map('heatmap', {
        zoomControl: true,
        fadeAnimation: true
      }).setView([-11.9750, -76.7700], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap contributors © CARTO'
      }).addTo(this.heatmapInstance);

      this.heatmapInstance.invalidateSize();
      this.circleLayers = L.layerGroup().addTo(this.heatmapInstance);
      this.updateHeatmapLayers();
    } catch (error) {
      console.error('Error initializing Leaflet heatmap:', error);
    }
  }

  private getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private updateHeatmapLayers() {
    if (!this.heatmapInstance || !this.circleLayers) return;

    this.circleLayers.clearLayers();

    const hotspotList = this.hotspots();
    const filterType = this.selectedTypeFilter();

    for (const spot of hotspotList) {
      if (spot.count === 0) continue;

      const radius = 80 + (spot.count * 15);
      const fillOpacity = Math.min(0.18 + (spot.count * 0.04), 0.45);

      let color = '#ef4444';
      if (filterType === 'Asalto') color = '#f59e0b';
      if (filterType === 'Emergencia') color = '#ef4444';
      if (filterType === 'Accidente') color = '#3b82f6';
      if (filterType === 'Vandalismo') color = '#ec4899';
      if (filterType === 'Reporte') color = '#8b5cf6';

      if (filterType === 'Todos') {
        if (spot.count > 10) color = '#b91c1c';
        else if (spot.count > 5) color = '#dc2626';
        else if (spot.count > 2) color = '#ec4899';
        else color = '#a78bfa';
      }

      const circle = L.circle([spot.lat, spot.lng], {
        color: color,
        fillColor: color,
        fillOpacity: fillOpacity,
        opacity: 0.65,
        weight: 1.5,
        radius: radius
      });

      let breakdownHtml = '';
      for (const [type, cnt] of Object.entries(spot.breakdown)) {
        if (cnt > 0) {
          breakdownHtml += `
            <div class="flex justify-between items-center text-xs mt-1 text-slate-800 font-sans">
              <span class="font-medium">${type}:</span>
              <span class="font-bold bg-slate-200 px-1.5 py-0.5 rounded text-[10px]">${cnt}</span>
            </div>`;
        }
      }

      const popupContent = `
        <div class="font-sans p-1 min-w-[150px]">
          <b class="text-sm block border-b pb-1 mb-1 text-indigo-600 font-bold">${spot.name}</b>
          <div class="text-xs text-slate-600 font-bold mb-1">Total Reportes: ${spot.count}</div>
          <div class="border-t pt-1 mt-1">
            ${breakdownHtml || '<div class="text-slate-400 text-xs italic">Sin reportes</div>'}
          </div>
        </div>
      `;

      circle.bindPopup(popupContent);
      this.circleLayers.addLayer(circle);
    }
  }
}
